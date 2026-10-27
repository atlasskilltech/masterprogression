# Masters Progression Portal (Node.js + EJS)

ATLAS SkillTech University — ported from the CodeIgniter 3 `masterprogression` app.
Same MySQL database (`diceapp`) and tables, no schema changes.

## What's built
- **Login** — Application ID → choose mobile → OTP verify (`ApplicationStatus.php`, `Verification.php`, `M_login.php`, step-1/2/3).
- **LoR** — wait, form, interview (formComplete), admission-fee, paymentSuccess, download screens (`Lor.php` + admissions views), rendered through a shared EJS layout (`views/admissions/layout.ejs`).
- **Payments** — Razorpay order create + signature verify + payment insert + receipt email (`Lor::razorPay/Verify`), using the official `razorpay` Node SDK.
- **Semester** — DICE fee API lookup → Razorpay → verify → thanks (`Semester.php`).

## Not yet ported (need source / fill-ins)
These run as clearly-marked stubs so the app boots; replace with real logic:
- `models/paymentsModel.js` — `feeDetails`, `taxDetails`, `applnFeePaidBasicDetails` (**need `M_payments.php`**)
- `models/documentsModel.js`, `models/semesterModel.js`, `models/enrollmentModel.js` (**need those models**)
- Views `declaration.ejs`, `step7.ejs`, `enrollmentThanks.ejs` are placeholders (**need the originals**)
- PDF receipt generation + AWS S3 upload in `Lor::_sendEmail` (need the pdf/mpdf + S3 pieces)
- `lang/payments`, `lang/login` strings — folded into code; adjust wording as needed
- The LoR form posts to a `demo` controller not yet supplied

## Setup
```bash
npm install
cp .env.example .env          # fill in all values
# copy your CI assets folder into public/assets/
npm run dev                   # http://localhost:3000/login/applicationStatus
```
`.env` keys: DB (`diceapp`), MSG91 + WATI (OTP), Razorpay, SendGrid SMTP, DICE fee API.
In local dev, blank `MSG91_AUTHKEY` prints the OTP to the console; `TEST_OTP=7879` always passes.

## Security
No credentials are hard-coded — all in `.env` (git-ignored). The Razorpay / MSG91 / WATI /
SendGrid / AWS keys that were in the original PHP in plain text should be **rotated**.

## Structure
```
app.js                      Express entry, sessions, layouts, route mounting
config/db.js                mysql2 pool -> diceapp DB
middleware/auth.js          requireLogin + status-based routing (M_applications::currentStatus)
models/                     loginModel, applicationsModel (+ payment/semester stubs)
services/razorpay.js        official Razorpay SDK wrapper
services/otpService.js      MSG91 SMS + WATI WhatsApp OTP
services/mailer.js          SendGrid SMTP via nodemailer
routes/login.js             applicationStatus + verification
routes/lor.js               LoR screens + Razorpay order/verify
routes/payments.js          paymentDone / paynow
routes/semester.js          DICE fee + Razorpay
views/login/                step-1/2/3
views/admissions/           layout + LoR/payment screens
views/mailer/               payment_success_email
public/assets/              your CI assets go here
```

## Status flow (from the CI switch)
`1` → LoR · `7` → formComplete · `8` → paynow · `9` → paymentSuccess · `10` → download
