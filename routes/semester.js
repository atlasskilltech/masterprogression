// Ported from Semester.php. Mounted at /semester.
// Semester fee is fetched from the external DICE fee API, then paid via Razorpay.
const express = require('express');
const router = express.Router();
const axios = require('axios');

const applications = require('../models/applicationsModel');
const razorpay = require('../services/razorpay');
const { requireLogin } = require('../middleware/auth');
require('dotenv').config();

router.use(requireLogin);

// On entry the CI constructor stored the enrollment txn id in the session.
router.use(async (req, res, next) => {
  try {
    const txn = await applications.checkEnrollmentDone(req.session.applnID);
    if (txn) req.session.enrollmentTXNID = txn;
  } catch (e) {
    console.error('checkEnrollmentDone:', e.message);
  }
  next();
});

// GET /semester  (index): pull fee from DICE API, create Razorpay order, show step7.
router.get('/', async (req, res) => {
  try {
    const studentID = await applications.getStudentId(req.session.applnID);
    const base = process.env.DICE_FEE_API_BASE || 'http://diceapp.in/dice/api/fee';

    const resp = await axios.post(
      `${base}/feeInfo`,
      new URLSearchParams({ studentID: String(studentID), date: '' }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
    );
    const result = resp.data;
    const first = result && result.data && result.data[0];
    if (!first) throw new Error('No fee info returned from DICE API');

    const grandAMT = first.grandAMT;
    req.session.amount = grandAMT * 100;
    req.session.feeInfo = buildFeeInfo(first);

    const order = await razorpay.createOrder(grandAMT, 0);
    req.session.razorpayOrder = order.id;
    const basicDetails = await applications.basicApplnDetails(req.session.applnID);

    res.render('admissions/step7', {
      layout: 'admissions/layout',
      basicDetails,
      active: 6,
      status: 0,
      amount: grandAMT,
      checkout: razorpay.checkoutOptions({ order, user: basicDetails }),
    });
  } catch (err) {
    console.error('semester index error:', err.message);
    res.status(502).send('Could not load semester fee right now. ' + err.message);
  }
});

// POST /semester/Verify : confirm payment with DICE, then advance status, go to thanks.
router.post('/Verify', async (req, res) => {
  const BASE = req.app.locals.BASE_URL || '';
  try {
    const amount = req.session.amount;
    const feeInfo = req.session.feeInfo;
    const studentID = await applications.getStudentId(req.session.applnID);
    const base = process.env.DICE_FEE_API_BASE || 'http://diceapp.in/dice/api/fee';

    const payload = {
      studentID,
      gstNumber: '',
      entityName: '',
      paymentInfo: { amount, razorpay_payment_id: req.body.razorpay_payment_id, usedWB: '0' },
      feeInfo,
    };
    await axios.post(`${base}/payment_isme`, new URLSearchParams(flatten(payload)).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    });

    await applications.setStatus(req.session.applnID, 11);
    res.redirect(`${BASE}/semester/thanks`);
  } catch (err) {
    console.error('semester Verify error:', err.message);
    res.status(500).send('Payment verification failed.');
  }
});

// GET /semester/thanks
router.get('/thanks', async (req, res) => {
  const basicDetails = await applications.basicApplnDetails(req.session.applnID);
  res.render('admissions/enrollmentThanks', {
    layout: 'admissions/layout',
    basicDetails,
    active: 6,
    status: 0,
  });
});

// POST /semester/semesterClick  (no-op handshake used by the LoR screens' JS)
router.post('/semesterClick', (req, res) => res.json({ status: 1 }));

// ---- helpers ----
function buildFeeInfo(d) {
  return {
    feeID: d.feeID, type: d.type, feeCode: d.feeCode, feeShortName: d.feeShortName,
    basicAMT: d.basicAMT, dueDate: d.dueDate, grandAMT: d.grandAMT, status: d.status,
    collectionID: d.collectionID, dateStatus: d.dateStatus,
    collectionDetailStatus: d.collectionDetailStatus,
    schemeInfo: d.schemeInfo, lateFeeInfo: d.lateFeeInfo,
    taxInfo: d.taxInfo, scholarshipInfo: d.scholarshipInfo,
  };
}

// http_build_query equivalent for nested objects (a[b][c]=v).
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v == null ? '' : v;
  }
  return out;
}

module.exports = router;
