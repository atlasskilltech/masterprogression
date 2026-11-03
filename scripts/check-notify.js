#!/usr/bin/env node
// Diagnose OTP delivery on the server.
//   node scripts/check-notify.js --mobile 98XXXXXXXX --email you@example.com
// Prints which settings are present (never their values), then sends a test
// OTP by SMS and by email and prints the provider's exact response/error.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const otp = require('../services/otpService');
const mailer = require('../services/mailer');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : '';
}
const has = (...names) => names.some((n) => process.env[n] && String(process.env[n]).trim());

(async () => {
  const mobile = arg('mobile');
  const email = arg('email');
  const sms = otp.smsConfig();
  const mail = mailer.config();

  console.log('--- settings (values hidden) ---');
  console.log('SMS_PROVIDER         :', sms.provider);
  console.log('MSG91 auth key       :', has('MSG91_AUTH_KEY', 'MSG91_AUTHKEY') ? 'set' : 'MISSING');
  console.log('MSG91 template id    :', sms.templateId ? 'set' : 'MISSING');
  console.log('SMTP host:port       :', `${mail.host}:${mail.port}`);
  console.log('SMTP user            :', mail.user || 'MISSING');
  console.log('SMTP pass / API key  :', mail.pass ? `set (${mail.pass.startsWith('SG.') ? 'SendGrid key' : 'not an SG. key?'})` : 'MISSING');
  console.log('From address         :', mail.from);
  console.log();

  if (!mobile && !email) {
    console.log('Pass --mobile and/or --email to send a test message.');
    return;
  }

  const code = otp.generateOtp();
  if (mobile) {
    console.log(`Sending test SMS OTP ${code} to ${mobile} ...`);
    console.log('SMS result:', (await otp.sendSmsOtp(mobile, code)) ? 'OK (accepted by MSG91)' : 'FAILED — see error above');
  }
  if (email) {
    if (mail.pass) {
      try {
        const nodemailer = require('nodemailer');
        await nodemailer.createTransport({
          host: mail.host, port: mail.port, secure: mail.port === 465,
          auth: { user: mail.user, pass: mail.pass },
        }).verify();
        console.log('SMTP login: OK');
      } catch (e) {
        console.log('SMTP login: FAILED —', e.response || e.message);
      }
    }
    console.log(`Sending test email OTP ${code} to ${email} ...`);
    console.log('Email result:', (await otp.sendEmailOtp(email, code, 'Test')) ? 'OK (accepted by SMTP)' : 'FAILED — see error above');
  }
})();
