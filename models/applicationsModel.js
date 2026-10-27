// Ported from M_applications.php (only the functions the controllers actually use).
// All queries hit the diceapp DB, same as CI's $this->load->database('diceapp', TRUE).
const pool = require('../config/db');

// M_applications::basicApplnDetails
// NOTE: CI used string interpolation. Here we parameterise to avoid SQL injection.
async function basicApplnDetails(applnID) {
  const sql = `
    SELECT master_p_id AS applnID, master_name AS name,
           master_progression_application.*, dice_school.*, dice_specialisation.*
    FROM master_progression_application
    JOIN dice_school        ON master_progression_application.master_school = dice_school.school_id
    JOIN dice_specialisation ON dice_specialisation.specialisation_id = master_progression_application.master_spe
    WHERE master_p_id = ?`;
  const [rows] = await pool.query(sql, [applnID]);
  return rows.length === 1 ? rows[0] : false;
}

// M_applications::setStatus
async function setStatus(applnID, status) {
  await pool.query(
    'INSERT INTO master_progression_application_status (master_progression_id, master_progression_status, master_progression_timestamp) VALUES (?, ?, NOW())',
    [applnID, status]
  );
}

// M_applications::currentStatus — returns the latest status number (0 if none).
// The CI version issued redirects directly; here we return the number and let
// middleware decide where to send the user (see middleware/auth.js).
async function currentStatus(applnID) {
  const [rows] = await pool.query(
    'SELECT master_progression_status FROM master_progression_application_status WHERE master_progression_id = ? ORDER BY master_progression_status DESC LIMIT 1',
    [applnID]
  );
  return rows.length === 1 ? parseInt(rows[0].master_progression_status, 10) : 0;
}

// M_applications::getEmailIDs — applicant + parent emails, non-empty, as an array.
async function getEmailIDs(applnID) {
  const [rows] = await pool.query(
    'SELECT `appln_email`,`appln_fatherEmail`,`appln_motherEmail` FROM isdi_admsn_appln WHERE appln_id = ?',
    [applnID]
  );
  if (!rows.length) return false;
  return Object.values(rows[0]).filter((v) => v && String(v).trim() !== '');
}

// M_applications::bccEmail
async function bccEmail(applnID) {
  const [rows] = await pool.query(
    `SELECT specialisation_bcc_email
     FROM isdi_admsn_appln
     JOIN isdi_school ON isdi_admsn_appln.appln_school = isdi_school.school_id
     JOIN isdi_admsn_specialisation ON isdi_admsn_appln.appln_specialisation = isdi_admsn_specialisation.specialisation_id
     WHERE appln_id = ?`,
    [applnID]
  );
  return rows.length === 1 ? rows[0] : false;
}

// M_applications::getRazorpayCustomerDetails2 — all virtual-account rows for an appln.
async function getRazorpayCustomerDetails2(applnID) {
  const [rows] = await pool.query(
    'SELECT * FROM isdi_admsn_razorpay_virtual_account WHERE appln_id = ?',
    [applnID]
  );
  return rows;
}

// M_applications::checkEnrollmentDone — sets session enrollmentTXNID if a payment exists.
// Returns the txnid or false; caller stores it in the session.
async function checkEnrollmentDone(applnID) {
  const [rows] = await pool.query(
    'SELECT payment_txnid FROM isdi_admsn_enrollment_payments WHERE payment_master_id = ?',
    [applnID]
  );
  return rows.length === 1 ? rows[0].payment_txnid : false;
}

// Files shown on the download screen (moved out of download.php's inline query).
async function getDownloadFiles(applnID) {
  const [rows] = await pool.query(
    `SELECT master_lor_file, master_transcript_file
     FROM master_progression_application
     JOIN master_progression_application_status
       ON master_progression_application_status.master_progression_id = master_p_id
     WHERE master_p_id = ? AND master_progression_application_status.master_progression_status = 10
     GROUP BY master_progression_status`,
    [applnID]
  );
  return rows.length === 1 ? rows[0] : { master_lor_file: '', master_transcript_file: '' };
}

// Student id for the external DICE fee API (used by the semester module).
async function getStudentId(applnID) {
  const [rows] = await pool.query(
    'SELECT student_id FROM dice_students WHERE student_app_id = ?',
    [applnID]
  );
  return rows.length ? rows[0].student_id : null;
}

// Record a Razorpay payment (M_applications/Lor::Verify insert).
async function insertPayment(table, data) {
  const [res] = await pool.query(`INSERT INTO ?? SET ?`, [table, data]);
  return res.affectedRows > 0;
}

module.exports = {
  basicApplnDetails,
  setStatus,
  currentStatus,
  getEmailIDs,
  bccEmail,
  getRazorpayCustomerDetails2,
  checkEnrollmentDone,
  getDownloadFiles,
  getStudentId,
  insertPayment,
};
