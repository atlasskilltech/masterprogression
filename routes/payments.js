// Mounted at /payments. The CI app routed both "payments/*" and "lor/*" to the
// same Lor controller. Here we expose the payment-specific endpoints the flow
// redirects to (paymentDone, paynow) and reuse the Lor render logic.
const express = require('express');
const router = express.Router();

const applications = require('../models/applicationsModel');
const { requireLogin, applyCurrentStatus } = require('../middleware/auth');

router.use(requireLogin, applyCurrentStatus);

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

// GET /payments/paymentDone  (declaration / receipt after a successful payment)
router.get('/paymentDone', (req, res) =>
  renderPage(req, res, 'declaration', { txnID: req.session.txnID || null })
);

// GET /payments/paynow  (admission fee / pay screen)
router.get('/paynow', (req, res) => renderPage(req, res, 'view_admission_fee'));

module.exports = router;
