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

// r****i@gmail.com style masking (same as the Admission portal's mask_email).
function maskEmail(e) {
  if (!e || String(e).indexOf('@') === -1) return '';
  const [user, domain] = String(e).split('@');
  if (user.length <= 2) return '*'.repeat(Math.max(user.length, 1)) + '@' + domain;
  return user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] + '@' + domain;
}

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
  let mobiles = {};
  let email = '';
  try {
    mobiles = (await loginModel.getMobileNos(req.session.applnStatus)) || {};
  } catch (err) {
    console.error('chooseMobile error:', err.message);
  }
  try {
    email = (await loginModel.getContact(req.session.applnStatus)).email;
  } catch (err) {
    console.error('chooseMobile email lookup error:', err.message);
  }
  res.render('login/step-2', { mobiles, maskedEmail: maskEmail(email) });
});

// GET /login/verification/goBackToApplnStatus
router.get('/verification/goBackToApplnStatus', (req, res) => {
  delete req.session.applnStatus;
  res.redirect(req.baseUrl + '/applicationStatus');
});

// POST /login/verification/generateOTP
// Sends the same code by SMS and (when the application has one) by email.
// Succeeds if at least one channel delivered it.
router.post('/verification/generateOTP', verificationGuard, async (req, res) => {
  const mobile = (req.body.mobile || '').trim();
  if (!mobile) {
    return res.json({ status: 0, msg: 'Please select a mobile number.' });
  }

  try {
    // Only allow numbers that actually belong to this application.
    const mobiles = (await loginModel.getMobileNos(req.session.applnStatus)) || {};
    if (!Object.values(mobiles).some((m) => String(m).trim() === mobile)) {
      return res.json({ status: 0, msg: 'Please select one of the numbers shown.' });
    }

    let contact = { email: '', name: '' };
    try {
      contact = await loginModel.getContact(req.session.applnStatus);
    } catch (err) {
      console.error('generateOTP email lookup error:', err.message);
    }

    const code = otp.generateOtp();
    const [smsOk, emailOk] = await Promise.all([
      otp.sendSmsOtp(mobile, code),
      contact.email ? otp.sendEmailOtp(contact.email, code, contact.name) : Promise.resolve(false),
    ]);
    otp.sendWhatsappOtp(mobile, code); // best-effort, not awaited

    console.log(`[OTP] appl ${req.session.applnStatus}: sms=${smsOk} email=${emailOk}${contact.email ? '' : ' (no email on file)'}`);

    if (smsOk || emailOk) {
      req.session.mobile = mobile;
      req.session.sentOtp = code;
      req.session.otpEmail = emailOk ? contact.email : '';
      return res.json({ status: 1, sms: !!smsOk, email: !!emailOk, msg: 'Success.' });
    }
    return res.json({
      status: 0,
      msg: 'We could not send the verification code. Please try again in a moment or contact admissions.',
    });
  } catch (err) {
    console.error('generateOTP error:', err.message);
    return res.json({ status: 0, msg: 'We could not send the verification code. Please try again.' });
  }
});

// GET /login/verification/verificationIndex
router.get('/verification/verificationIndex', verificationGuard, (req, res) => {
  if (!req.session.mobile) {
    return res.redirect(req.baseUrl + '/verification/chooseMobile');
  }
  res.render('login/step-3', {
    mobileLast4: String(req.session.mobile).slice(-4),
    maskedEmail: maskEmail(req.session.otpEmail),
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
  delete req.session.otpEmail;

  res.json({ status: 1, msg: 'Success.' });
});

module.exports = router;
