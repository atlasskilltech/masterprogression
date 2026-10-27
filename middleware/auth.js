// Auth + status guards shared by the Lor / payments / semester controllers.
const applications = require('../models/applicationsModel');

// Equivalent of the CI __construct check: redirect to login if not logged in.
function requireLogin(req, res, next) {
  if (!req.session.applnID) {
    return res.redirect((req.app.locals.BASE_URL || '') + '/login/applicationStatus');
  }
  next();
}

// Equivalent of M_applications::currentStatus() — routes the user to the screen
// matching their latest status. CI did this inline with redirects; we centralise it.
// Status map (from the CI switch): 1 -> lor, 7 -> lor/formComplete,
// 8 -> payments/paynow, 9 -> lor/paymentSuccess, 10 -> lor/download.
async function applyCurrentStatus(req, res, next) {
  const BASE = req.app.locals.BASE_URL || '';
  try {
    const status = await applications.currentStatus(req.session.applnID);
    req.currentStatus = status;

    // seg2 = the method segment after the controller (e.g. /lor/form -> "form")
    const parts = req.originalUrl.split('?')[0].replace(BASE, '').split('/').filter(Boolean);
    const seg1 = (parts[0] || '').toLowerCase();
    const seg2 = (parts[1] || '').toLowerCase();

    const go = (target, whenSeg) => {
      if (whenSeg !== undefined && seg2 === whenSeg.toLowerCase()) return false;
      res.redirect(`${BASE}/${target}`);
      return true;
    };

    switch (status) {
      case 1:
        if (seg1 !== 'lor') return go('lor');
        break;
      case 7:
        if (go('lor/formComplete', 'formcomplete')) return;
        break;
      case 8:
        if (go('payments/paynow', 'paynow')) return;
        break;
      case 9:
        if (go('lor/paymentSuccess', 'paymentsuccess')) return;
        break;
      case 10:
        if (go('lor/download', 'download')) return;
        break;
      default:
        break;
    }
    next();
  } catch (err) {
    console.error('applyCurrentStatus error:', err.message);
    next(); // don't block the page on a status lookup failure
  }
}

module.exports = { requireLogin, applyCurrentStatus };
