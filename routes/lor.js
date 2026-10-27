// Ported from Lor.php. Mounted at /lor (and /payments — see routes/payments.js).
// Screens render through the admissions layout (views/admissions/layout.ejs).
const express = require('express');
const router = express.Router();

const applications = require('../models/applicationsModel');
const payments = require('../models/paymentsModel');
const razorpay = require('../services/razorpay');
const mailer = require('../services/mailer');
const { requireLogin, applyCurrentStatus } = require('../middleware/auth');

// Every route requires login; applyCurrentStatus mirrors the CI constructor routing.
router.use(requireLogin, applyCurrentStatus);

// Render a content view inside the admissions layout with the standard header data.
async function renderPage(req, res, view, extra = {}, active = 1) {
  const basicDetails = await applications.basicApplnDetails(req.session.applnID);
  res.render(`admissions/${view}`, {
    layout: 'admissions/layout',
    basicDetails,
    active,
    status: req.currentStatus || 0,
    ...extra,
  });
}

// GET /lor  (index -> lorWait)
router.get('/', (req, res) => renderPage(req, res, 'lorWait'));

// GET /lor/form  (LoR form)
router.get('/form', (req, res) => renderPage(req, res, 'lorForm'));

// GET /lor/formComplete  (interview details)
router.get('/formComplete', async (req, res) => {
  const basicDetails = await applications.basicApplnDetails(req.session.applnID);
  const d = basicDetails.master_interview_date ? new Date(basicDetails.master_interview_date) : null;
  const fmtDate = d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const fmtTime = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  res.render('admissions/interview', {
    layout: 'admissions/layout',
    basicDetails,
    active: 1,
    status: req.currentStatus || 0,
    interviewDate: fmtDate,
    interviewTime: fmtTime,
    interviewType: basicDetails.master_interview_venue,
    interviewURL: basicDetails.master_interview_url,
  });
});

// GET /lor/formPayment  (admission fee screen)
router.get('/formPayment', (req, res) => renderPage(req, res, 'view_admission_fee'));

// GET /lor/paymentSuccess
router.get('/paymentSuccess', (req, res) => renderPage(req, res, 'paymentSuccess'));

// GET /lor/download
router.get('/download', async (req, res) => {
  const files = await applications.getDownloadFiles(req.session.applnID);
  renderPage(req, res, 'download', {
    master_lor_file: files.master_lor_file,
    master_transcript_file: files.master_transcript_file,
  });
});

// GET /lor/paymentDone  (declaration / receipt)
router.get('/paymentDone', (req, res) =>
  renderPage(req, res, 'declaration', { txnID: req.session.txnID || null })
);

// POST /lor/razorPay  (create order, return checkout options as JSON)
router.post('/razorPay', async (req, res) => {
  try {
    const fee = await payments.feeDetails(req.session.applnID);
    req.session.amount = fee.totalAmt;
    const order = await razorpay.createOrder(fee.totalAmt, 3456);
    req.session.razorpayOrder = order.id;
    const user = await applications.basicApplnDetails(req.session.applnID);
    res.json(razorpay.checkoutOptions({ order, user }));
  } catch (err) {
    console.error('razorPay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /lor/Verify  (Razorpay callback -> verify, record, email, advance status)
router.post('/Verify', async (req, res) => {
  const BASE = req.app.locals.BASE_URL || '';
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_payment_id || !razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return res.redirect(`${BASE}/payments/paymentDone`); // failure path (same as CI)
  }

  try {
    const order = await razorpay.fetchOrder(razorpay_order_id);
    const payment = await razorpay.fetchPayment(razorpay_payment_id);
    req.session.txnID = razorpay_payment_id;

    const insertData = {
      payment_bankname: payment.bank || '',
      payment_paymentmode: payment.method,
      payment_mid: '',
      payment_txnid: razorpay_payment_id,
      payment_respcode: '',
      payment_is_checksum_valid: 1,
      payment_status: order.status,
      payment_currency: payment.currency,
      payment_banktxnid: razorpay_payment_id,
      payment_orderid: razorpay_order_id,
      payment_txndate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      payment_respmsg: '',
      payment_txnamount: order.amount / 100,
      payment_txn_amt_from_gateway: payment.amount / 100,
      payment_gatewayname: 'Razorpay',
      payment_method: 6,
      payment_txntype: '',
      payment_refundamt: payment.refund_status || '',
      payment_ref: '',
      payment_due_date: '',
      payment_master_id: req.session.applnID,
    };

    const ok = await applications.insertPayment('isdi_admsn_payments', insertData);
    await applications.setStatus(req.session.applnID, 2);

    // Fire the receipt email (best-effort; won't block the redirect).
    sendPaymentEmail(req.session.applnID).catch((e) => console.error('receipt email:', e.message));

    if (ok) return res.redirect(`${BASE}/payments/paymentDone`);
    return res.status(500).send('Could not record payment.');
  } catch (err) {
    console.error('Verify error:', err.message);
    return res.redirect(`${BASE}/payments/paymentDone`);
  }
});

// Equivalent of Lor::_sendEmail (PDF attach + S3 upload are TODO — need those libs/views).
async function sendPaymentEmail(applnID) {
  const basicApplnDetails = await applications.basicApplnDetails(applnID);
  const amount = await payments.feeDetails(applnID);
  const taxDetails = await payments.taxDetails(amount.basicAmt);
  const to = await applications.getEmailIDs(applnID);

  const html = await mailer.render('payment_success_email', { basicApplnDetails, amount, taxDetails });
  await mailer.send({
    to,
    subject: 'Payment Successful - ATLAS SkillTech University',
    html,
    // TODO: attach the generated PDF receipt + upload to S3 once those are ported.
  });
}

module.exports = router;
