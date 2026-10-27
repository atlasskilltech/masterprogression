// ATLAS SkillTech University — Masters Progression Portal
// Node.js + Express + EJS. Ported from CodeIgniter 3.
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();

const app = express();

// Base path the app is mounted under. '' for local, e.g. '/masterprogression' in prod.
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
app.locals.BASE_URL = BASE_URL;

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Layouts are opt-in: login pages are standalone; admissions pages pass
// layout:'admissions/layout' in their render() call.
app.use(expressLayouts);
app.set('layout', false);

// ---- Body parsing (AJAX posts send form-encoded data, like the CI app) ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---- Sessions (replaces CI's $this->session) ----
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'masterprogression-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 }, // 4h
  })
);

// ---- base_url() helper for views (mirrors CI's base_url()) ----
// base_url()            -> '/'  (or '/masterprogression/')
// base_url('login/x')   -> '/login/x'
app.use((req, res, next) => {
  res.locals.base_url = (p = '') => `${BASE_URL}/${String(p).replace(/^\//, '')}`;
  next();
});

// ---- Static assets (put your CI /assets folder into /public/assets) ----
app.use(`${BASE_URL}/assets`, express.static(path.join(__dirname, 'public', 'assets')));

// ---- Routes ----
app.use(`${BASE_URL}/login`, require('./routes/login'));
app.use(`${BASE_URL}/lor`, require('./routes/lor'));
app.use(`${BASE_URL}/payments`, require('./routes/payments'));
app.use(`${BASE_URL}/semester`, require('./routes/semester'));

// Root -> the first login step (matches the live URL .../login/applicationStatus)
app.get(`${BASE_URL}/`, (req, res) => res.redirect(`${BASE_URL}/login/applicationStatus`));

// ---- Startup DB check ----
// Fail loudly and clearly if the diceapp DB is unreachable, instead of only
// surfacing "Access denied / using password: NO" later on the first login.
const pool = require('./config/db');
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`DB connected: ${process.env.DB_USER || 'root'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'diceapp'}`);
  } catch (err) {
    console.error('DB connection FAILED:', err.message);
    if (/using password: NO/.test(err.message)) {
      console.error('-> No DB password was sent. Create a .env file (cp .env.example .env) and set DB_PASSWORD.');
    }
  }
})();

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Masters Progression Portal running on http://localhost:${PORT}${BASE_URL}/login/applicationStatus`);
});

// Give a clear message when the port is already taken (common with pm2
// starting a second instance) instead of crashing with a raw EADDRINUSE stack.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Another process (or a duplicate pm2 instance) is bound to it.`);
    console.error(`-> Find it:  lsof -i :${PORT}   (or: pm2 list)   then stop the stray process and restart.`);
    process.exit(1);
  }
  throw err;
});
