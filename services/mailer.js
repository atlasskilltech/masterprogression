// Email service — replaces CI's email library (SendGrid SMTP).
// Credentials come from .env. If not configured, emails are skipped (logged).
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

function transport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// number_format(x, 2) helper for the mailer templates.
function nf(x) {
  const n = Number(x) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Render a mailer EJS template to an HTML string.
async function render(view, data) {
  const base = (process.env.BASE_URL || '').replace(/\/$/, '');
  const locals = {
    ...data,
    nf,
    base_url: (p = '') => `${base}/${String(p).replace(/^\//, '')}`,
  };
  const file = path.join(__dirname, '..', 'views', 'mailer', `${view}.ejs`);
  return ejs.renderFile(file, locals);
}

// Send an email. opts: { to, cc, bcc, subject, html }
async function send(opts) {
  const t = transport();
  if (!t) {
    console.log(`[mail][dev] would send "${opts.subject}" to`, opts.to);
    return;
  }
  await t.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ATLAS Master Progression'}" <${process.env.MAIL_FROM || 'masterprogression@atlasuniversity.edu.in'}>`,
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    subject: opts.subject,
    html: opts.html,
  });
}

module.exports = { send, render, nf };
