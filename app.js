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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Masters Progression Portal running on http://localhost:${PORT}${BASE_URL}/login/applicationStatus`);
});
