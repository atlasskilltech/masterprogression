// Login + OTP verification routes.
// Ports ApplicationStatus.php and Verification.php (CodeIgniter controllers).
//
// URL map (kept identical to the CI app so existing links/bookmarks work):
//   GET  /login/applicationStatus                       -> step-1 (enter Application ID)
//   POST /login/applicationStatus/loginWithApplnID      -> validate ID (JSON)
//   GET  /login/verification/chooseMobile               -> step-2 (pick mobile)
//   GET  /login/verification/goBackToApplnStatus        -> back to step-1
//   POST /login/verification/generateOTP                -> send OTP (JSON)
//   GET  /login/verification/verificationIndex          -> step-3 (enter OTP)
//   POST /login/verification/VerificationOTP            -> verify OTP (JSON)
const express = require('express');
const router = express.Router();

const loginModel = require('../models/loginModel');
const otp = require('../services/otpService');

/* ------------------------------------------------------------------ */
/* applicationStatus controller                                        */
/* ------------------------------------------------------------------ */

// GET /login/applicationStatus  (index)
router.get('/applicationStatus', (req, res) => {
  // CI __construct: if applnStatus set, jump to choose-mobile step.
  if (req.session.applnStatus) {
    return res.redirect(req.baseUrl + '/verification/chooseMobile');
  }
  res.render('login/step-1');
});

// POST /login/applicationStatus/loginWithApplnID
router.post('/applicationStatus/loginWithApplnID', async (req, res) => {
  const applnID = (req.body.applnID || '').trim();

  if (!applnID) {
    return res.json({ status: 0, error: 'Required' });
  }

  try {
    const ok = await loginModel.checkApplnID(applnID);
    if (ok) {
      req.session.applnStatus = applnID;
      return res.json({ status: 1 });
    }
    return res.json({ status: 0, error: 'Invalid Application ID.' });
  } catch (err) {
    console.error('loginWithApplnID error:', err.message);
    return res.json({ status: 0, error: 'Something went wrong. Please try again.' });
  }
});

/* ------------------------------------------------------------------ */
/* verification controller                                             */
/* ------------------------------------------------------------------ */

// Shared guard (CI Verification::__construct) for every /verification route.
function verificationGuard(req, res, next) {
  if (req.session.applnID) {
    return res.redirect((req.app.locals.BASE_URL || '') + '/lor');
  }
  if (!req.session.applnStatus) {
    return res.redirect(req.baseUrl + '/applicationStatus');
  }
  next();
}

// GET /login/verification/chooseMobile
router.get('/verification/chooseMobile', verificationGuard, async (req, res) => {
  try {
    const mobiles = await loginModel.getMobileNos(req.session.applnStatus);
    res.render('login/step-2', { mobiles: mobiles || {} });
  } catch (err) {
    console.error('chooseMobile error:', err.message);
    res.render('login/step-2', { mobiles: {} });
  }
});

// GET /login/verification/goBackToApplnStatus
router.get('/verification/goBackToApplnStatus', (req, res) => {
  delete req.session.applnStatus;
  res.redirect(req.baseUrl + '/applicationStatus');
});

// POST /login/verification/generateOTP
router.post('/verification/generateOTP', verificationGuard, async (req, res) => {
  const mobile = (req.body.mobile || '').trim();
  if (!mobile) {
    return res.json({ status: 0, msg: 'Please select a mobile number.' });
  }

  try {
    const code = otp.generateOtp();
    const sent = await otp.sendSmsOtp(mobile, code);
    otp.sendWhatsappOtp(mobile, code); // best-effort, not awaited

    if (sent) {
      req.session.mobile = mobile;
      req.session.sentOtp = code;
      return res.json({ status: 1, msg: 'Success.' });
    }
    return res.json({
      status: 0,
      msg: '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> Error in generating OTP.',
    });
  } catch (err) {
    console.error('generateOTP error:', err.message);
    return res.json({ status: 0, msg: 'Error in generating OTP.' });
  }
});

// GET /login/verification/verificationIndex
router.get('/verification/verificationIndex', verificationGuard, (req, res) => {
  if (!req.session.mobile) {
    return res.redirect(req.baseUrl + '/verification/chooseMobile');
  }
  res.render('login/step-3', {
    mobileLast4: String(req.session.mobile).slice(-4),
  });
});

// POST /login/verification/VerificationOTP
router.post('/verification/VerificationOTP', verificationGuard, (req, res) => {
  const entered = (req.body.otp || '').trim();
  if (!entered) {
    return res.json({ status: 0, msg: 'Required' });
  }

  const testOtp = process.env.TEST_OTP;
  const matches = entered === String(req.session.sentOtp) || (testOtp && entered === testOtp);

  if (!matches) {
    return res.json({ status: 0, msg: "OTP doesn't match." });
  }

  // Success: promote applnStatus -> applnID (user is now "logged in").
  req.session.applnID = req.session.applnStatus;
  delete req.session.applnStatus;
  delete req.session.mobile;
  delete req.session.sentOtp;

  res.json({ status: 1, msg: 'Success.' });
});

module.exports = router;
