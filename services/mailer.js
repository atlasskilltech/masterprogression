// Email service — replaces CI's email library (SendGrid SMTP).
// Credentials come from .env. If not configured, emails are skipped (logged).
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

const env = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
};

function config() {
  const pass = env('SMTP_PASS', 'SENDGRID_API_KEY');
  return {
    host: env('SMTP_HOST') || 'smtp.sendgrid.net',
    port: Number(env('SMTP_PORT')) || 587,
    user: env('SMTP_USER') || (pass ? 'apikey' : ''), // SendGrid SMTP user is literally "apikey"
    pass,
    from: env('MAIL_FROM', 'EMAIL_FROM') || 'masterprogression@atlasuniversity.edu.in',
    fromName: env('MAIL_FROM_NAME') || 'ATLAS Master Progression',
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.user && c.pass);
}

let cached = null;
function transport() {
  const c = config();
  if (!c.user || !c.pass) return null;
  const key = `${c.host}|${c.port}|${c.user}|${c.pass}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      t: nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465,
        auth: { user: c.user, pass: c.pass },
      }),
    };
  }
  return cached.t;
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

// Send an email. opts: { to, cc, bcc, subject, html, text }. Resolves true/false.
async function send(opts) {
  const t = transport();
  if (!t) {
    console.error(`[mail] SMTP not configured (SMTP_PASS / SENDGRID_API_KEY empty) — "${opts.subject}" NOT sent to`, opts.to);
    return false;
  }
  const c = config();
  try {
    const info = await t.sendMail({
      from: `"${c.fromName}" <${c.from}>`,
      to: opts.to,
      cc: opts.cc,
      bcc: opts.bcc,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (info.rejected && info.rejected.length) {
      console.error('[mail] rejected recipients:', info.rejected, info.response);
      return info.accepted && info.accepted.length > 0;
    }
    return true;
  } catch (err) {
    console.error('[mail] send failed:', err.responseCode || '', err.response || err.message);
    return false;
  }
}

module.exports = { send, render, nf, isConfigured, config };
