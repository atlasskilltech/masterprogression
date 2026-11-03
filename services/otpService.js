// OTP delivery: SMS (MSG91), email (SendGrid via services/mailer) and WhatsApp (WATI).
// Ported from Verification.php.
//
// Design notes vs. the CI code:
//  - We generate the OTP, send it, store it in the session, and verify
//    against the session value (plus an optional TEST_OTP backdoor).
//  - No secrets are hard-coded; everything comes from .env.
//  - SMS_PROVIDER=stub prints the OTP to the console instead of sending
//    (local dev). SMS_PROVIDER=msg91 (default when a key is set) sends for
//    real and reports failure honestly — a missing key is an error, not a
//    silent "success".
const axios = require('axios');
const mailer = require('./mailer');
require('dotenv').config();

const env = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
};

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 8001)); // 1000-9000, like rand(1000,9000)
}

function smsConfig() {
  const authkey = env('MSG91_AUTHKEY', 'MSG91_AUTH_KEY');
  const templateId = env('MSG91_TEMPLATE_ID', 'MSG91_TEMPLATE_OTP');
  const provider = (env('SMS_PROVIDER') || (authkey ? 'msg91' : 'stub')).toLowerCase();
  const baseUrl = env('MSG91_BASE_URL') || 'https://control.msg91.com';
  return { authkey, templateId, provider, baseUrl };
}

// MSG91 OTP send (equivalent of Verification::sendOtp). Resolves true/false.
async function sendSmsOtp(mobile, otp) {
  const { authkey, templateId, provider, baseUrl } = smsConfig();

  if (provider === 'stub') {
    console.log(`[OTP][stub] SMS not sent (SMS_PROVIDER=stub). OTP for ${mobile} = ${otp}`);
    return true;
  }
  if (!authkey || !templateId) {
    console.error('[OTP] MSG91 is not configured — set MSG91_AUTH_KEY and MSG91_TEMPLATE_OTP in .env');
    return false;
  }

  const digits = String(mobile).replace(/\D/g, '');
  const msisdn = digits.length === 10 ? `91${digits}` : digits;

  try {
    const res = await axios.post(`${baseUrl}/api/v5/otp`, { Value1: '1910' }, {
      params: { invisible: 1, authkey, mobile: msisdn, template_id: templateId, otp },
      headers: { 'cache-control': 'no-cache', 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const data = res.data || {};
    if (data.type === 'success') return true;
    console.error('[OTP] MSG91 rejected the request:', JSON.stringify(data));
    return false;
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[OTP] MSG91 send failed:', detail);
    return false;
  }
}

// Email the OTP to the applicant. Resolves true/false.
async function sendEmailOtp(email, otp, name) {
  if (!email) return false;
  try {
    const html = await mailer.render('otp_email', { otp, name: name || '' });
    return await mailer.send({
      to: email,
      subject: `${otp} is your ATLAS Masters Progression verification code`,
      html,
      text: `Your ATLAS Masters Progression verification code is ${otp}. Do not share this code with anyone.`,
    });
  } catch (err) {
    console.error('[OTP] email render/send failed:', err.message);
    return false;
  }
}

// WATI WhatsApp OTP (equivalent of Verification::sendWhatsappOtp) — best-effort.
async function sendWhatsappOtp(mobile, otp) {
  const token = env('WATI_TOKEN');
  const base = env('WATI_BASE_URL');
  const template = env('WATI_TEMPLATE_NAME') || 'otp_login_app';

  if (!token || !base) return; // skip if not configured

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
  }
}

module.exports = { generateOtp, sendSmsOtp, sendEmailOtp, sendWhatsappOtp, smsConfig };
