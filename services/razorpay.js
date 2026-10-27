// Razorpay integration using the official Node SDK (replaces third_party/razorpay-php).
// Keys come from .env — never hard-code them.
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

function client() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys missing — set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env');
  }
  return new Razorpay({ key_id, key_secret });
}

// Create an order (amount in rupees; converted to paise, rounded like the PHP).
async function createOrder(amountRupees, receipt = 'rcpt') {
  const amount = Math.round(amountRupees) * 100;
  const order = await client().orders.create({
    receipt: String(receipt),
    amount,
    currency: 'INR',
    payment_capture: 1,
  });
  return order;
}

// Verify the checkout signature (equivalent of utility->verifyPaymentSignature).
function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  return expected === razorpay_signature;
}

async function fetchOrder(id) {
  return client().orders.fetch(id);
}
async function fetchPayment(id) {
  return client().payments.fetch(id);
}

// Build the options object the Razorpay checkout.js needs on the page.
function checkoutOptions({ order, user }) {
  return {
    key: process.env.RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: 'INR',
    name: 'ATLAS SkillTech University',
    description: 'Masters Progression',
    prefill: {
      name: user ? user.name : '',
      email: user ? user.email : '',
      contact: user ? (user.phone || user.master_phone || '') : '',
    },
    notes: { address: '' },
    theme: { color: '#F37254' },
    order_id: order.id,
  };
}

module.exports = {
  createOrder,
  verifySignature,
  fetchOrder,
  fetchPayment,
  checkoutOptions,
};
