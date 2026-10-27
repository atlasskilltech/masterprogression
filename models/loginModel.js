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

module.exports = { checkApplnID, getMobileNos };
