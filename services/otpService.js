// OTP + WhatsApp service.
// Ported from Verification.php (sendOtp via MSG91, sendWhatsappOtp via WATI).
//
// Design note vs. the CI code:
//  - The PHP generated its own random OTP, sent it, AND then verified via
//    MSG91's own verify endpoint (inconsistent). Here we keep it simple and
//    reliable: we generate the OTP, send it, store it in the session, and
//    verify against the session value (plus an optional TEST_OTP backdoor,
//    same as the old `if($otp == "7879")`).
//  - No secrets are hard-coded. If MSG91_AUTHKEY / WATI_TOKEN are blank
//    (e.g. local dev), sending is skipped and the OTP is logged to the
//    console so you can still test the flow end to end.
const axios = require('axios');
require('dotenv').config();

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 8001)); // 1000-9000, like rand(1000,9000)
}

// MSG91 OTP send (equivalent of Verification::sendOtp)
async function sendSmsOtp(mobile, otp) {
  const authkey = process.env.MSG91_AUTHKEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authkey) {
    console.log(`[OTP][dev] MSG91 not configured. OTP for ${mobile} = ${otp}`);
    return true; // allow local testing
  }

  try {
    const url = `https://api.msg91.com/api/v5/otp?invisible=1&authkey=${authkey}&mobile=91${mobile}&template_id=${templateId}&otp=${otp}`;
    const res = await axios.post(url, { Value1: '1910' }, {
      headers: { 'cache-control': 'no-cache' },
      timeout: 30000,
    });
    return res.data || true;
  } catch (err) {
    console.error('[OTP] MSG91 send failed:', err.message);
    return false;
  }
}

// WATI WhatsApp OTP (equivalent of Verification::sendWhatsappOtp)
async function sendWhatsappOtp(mobile, otp) {
  const token = process.env.WATI_TOKEN;
  const base = process.env.WATI_BASE_URL;
  const template = process.env.WATI_TEMPLATE_NAME || 'otp_login_app';

  if (!token || !base) return; // best-effort, skip if not configured

  try {
    const url = `${base}/api/v1/sendTemplateMessages`;
    const body = {
      template_name: template,
      broadcast_name: `${template}-${Date.now()}`,
      receivers: [
        { whatsappNumber: String(mobile), customParams: [{ name: '1', value: String(otp) }] },
      ],
    };
    await axios.post(url, body, {
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      timeout: 30000,
    });
  } catch (err) {
    console.error('[OTP] WATI WhatsApp send failed:', err.message);
    // non-fatal, same as the PHP which ignored the result
  }
}

module.exports = { generateOtp, sendSmsOtp, sendWhatsappOtp };
