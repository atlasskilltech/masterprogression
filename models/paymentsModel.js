// Ported placeholder for M_payments.php — SOURCE NOT YET SUPPLIED.
// The Lor controller calls these three. The exact SQL/tables are unknown until
// you send M_payments.php. The shapes below match how the controller + mailer
// use the data, so the app runs; replace the bodies with the real queries.
const pool = require('../config/db'); // eslint-disable-line no-unused-vars

// Lor uses: feeDetails(applnID)['totalAmt'] and ['basicAmt'].
// TODO: port real query from M_payments::feeDetails
async function feeDetails(applnID) {
  // return { basicAmt, totalAmt, ... }
  throw new Error('paymentsModel.feeDetails not implemented — send M_payments.php to port it');
}

// Mailer uses: taxDetails -> [{ tax_name, tax_value, amount }, ...]
// TODO: port real query from M_payments::taxDetails
async function taxDetails(basicAmt) {
  return []; // no tax rows until ported
}

// TODO: port M_payments::applnFeePaidBasicDetails
async function applnFeePaidBasicDetails(applnID) {
  return null;
}

module.exports = { feeDetails, taxDetails, applnFeePaidBasicDetails };
