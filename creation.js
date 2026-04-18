const express = require('express');
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors()); // allow requests from your frontend

// Example prices
const ticketPrices = {
  Single: 300,  // in Kshs
  Couples: 500,
  VIP: 500,
  VVIP: 5000
};

// Simple in-memory storage for orders (use DB in production)
const orders = [];

// Setup Nodemailer (Gmail example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mosonemma2001@gmail.com',        // replace with your email
    pass: '2001@Ssong'             // use app password if Gmail
  }
});

// Create Stripe Checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { name, email, ticketType } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: ticketType + ' Ticket' },
          unit_amount: ticketPrices[ticketType] * 100 / 150 // convert Kshs to approximate USD (adjust if needed)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: 'creation.html', // change to your frontend
      cancel_url: 'http://localhost:5500/cancel.html'
    });

    res.json({ id: session.id });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error creating checkout session');
  }
});

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, 'YOUR_WEBHOOK_SECRET');
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const voucherCode = `${session.customer_email.split('@')[0].toUpperCase()}-${Math.floor(Math.random()*100000)}`;
    
    // Store order in memory
    orders.push({
      name: session.customer_details.name || 'Customer',
      email: session.customer_email,
      ticketType: session.metadata?.ticketType || 'Unknown',
      voucherCode
    });

    console.log('Voucher Generated:', voucherCode);

    // Send voucher email
    try {
      await transporter.sendMail({
        from: 'youremail@gmail.com',
        to: session.customer_email,
        subject: 'Your Summer Festival Ticket Voucher',
        text: `Hello! Thank you for buying a ticket.\n\nYour voucher code: ${voucherCode}\nTicket Type: ${session.metadata?.ticketType || 'Unknown'}\nEnjoy the festival!`
      });
      console.log('Voucher email sent');
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }

  res.json({ received: true });
});

app.listen(3000, () => console.log('Server running on port 3000'));
