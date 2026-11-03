// Ported from M_login.php (CodeIgniter model).
// Queries the master_progression_application table in the diceapp DB.
const pool = require('../config/db');

// Equivalent of M_login::checkApplnID()
// Returns the applnID when exactly one matching row exists, else false.
async function checkApplnID(applnID) {
  const [rows] = await pool.query(
    'SELECT master_p_id FROM master_progression_application WHERE master_p_id = ?',
    [String(applnID)]
  );
  return rows.length === 1 ? applnID : false;
}

// Equivalent of M_login::getMobileNos()
// Returns an object of non-empty phone fields keyed by column name,
// e.g. { master_phone: '9812345678' }. Returns false if no single row.
async function getMobileNos(applnID) {
  const [rows] = await pool.query(
    'SELECT `master_phone` FROM master_progression_application WHERE master_p_id = ?',
    [applnID]
  );
  if (rows.length !== 1) return false;

  const row = rows[0];
  const mobiles = {};
  for (const [key, val] of Object.entries(row)) {
    if (val !== null && String(val).trim() !== '') mobiles[key] = val;
  }
  return mobiles;
}

// Applicant email + name for the OTP email.
// SELECT * so an unexpected column name never breaks login; we pick the
// first non-empty email-looking column.
const EMAIL_COLUMNS = ['master_email', 'master_email_id', 'master_emailid', 'master_emailID', 'email'];
async function getContact(applnID) {
  const [rows] = await pool.query(
    'SELECT * FROM master_progression_application WHERE master_p_id = ? LIMIT 1',
    [applnID]
  );
  if (!rows.length) return { email: '', name: '' };
  const row = rows[0];
  let email = '';
  for (const col of EMAIL_COLUMNS) {
    if (row[col] && String(row[col]).includes('@')) { email = String(row[col]).trim(); break; }
  }
  if (!email) {
    const col = Object.keys(row).find((k) => /email/i.test(k) && row[k] && String(row[k]).includes('@'));
    if (col) email = String(row[col]).trim();
  }
  return { email, name: row.master_name ? String(row.master_name).trim() : '' };
}

module.exports = { checkApplnID, getMobileNos, getContact };
