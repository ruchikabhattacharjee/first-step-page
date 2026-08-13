# CashFlow Pro

A cash-flow management web app for small & medium businesses (SMEs). It turns raw
receivables, payables and bank activity into a live picture of a business's
financial health — what's coming in, what's going out, what's overdue, and where
the money is going — with multi-user access control and AI-free PDF import for
invoices and bills.

Built as a full-stack **Next.js 16** application (App Router) with **React 19**,
**TypeScript**, and **Prisma + SQLite**.

---

## ✨ Features

**Accounts & access**
- Email sign-up with **OTP verification** and password reset (6-digit codes by email)
- Session auth via JWT in an HttpOnly cookie
- **Multi-tenant**: each business's data is isolated; invited team members share the owner's workspace
- **Role-based access control (RBAC)** — `Admin`, `Accountant` (both can edit), `Viewer` (read-only). The bank balance is blurred for Viewers.
- **Team management** (Admin): invite employees by email, assign roles, remove members

**Dashboard**
- Current bank balance, 30-day money in/out, net cash change
- **Action Center** — a clickable panel of overdue invoices (who to collect from) and bills (who to pay), with one-click **payment-reminder emails** to customers
- Insight charts: 30-day cash-flow area chart, expense-by-category donut, receivables aging
- Recent transactions with a full "bank feed" view
- **Export Report** — one-click, downloadable **PDF business snapshot** (KPIs, cash-flow chart, expense breakdown, receivables aging, statement of cash flows, budget vs actuals, forecast, and action items). Named `businessname_date_time.pdf`, with a confirm-and-prepare flow; available to Admin/Accountant, withheld from Viewers.

**Accounts Receivable (Invoices)**
- Create / edit / delete invoices with line items and tax
- Mark paid (logs a collection into the ledger and updates the balance)
- Aging status (current / overdue tiers), DSO KPI

**Accounts Payable (Bills)**
- Create / edit / delete vendor bills by category
- Mark paid, quick-expense logging

**Contacts** — unified customer/vendor directory with per-contact transaction history and net balance

**Analytics**
- Statement of Cash Flows (operating / investing / financing)
- Risk-adjusted balance **forecast** (confirmed / best / worst case)
- **Budget vs Actuals** with progress bars

**PDF import (local, no API key / no cloud)**
- Upload up to 10 invoice/bill **PDFs** at once
- Extraction runs **entirely on your machine**: reads the PDF text layer first, falls back to **Tesseract OCR** for scanned documents, then parses out vendor/customer, number, dates, category, line items and totals
- **Review & edit** every field (with confidence flags) before anything is saved
- Sample PDFs included — generate them with `npm run gen:samples`

**Demo data** — a realistic 90-day, industry-aware ledger generator powers the seed and the "Connect Bank" onboarding step.

---

## 🧱 Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript, plain CSS (glassmorphism design system) |
| Charts | Recharts |
| Icons | lucide-react |
| Database | SQLite via Prisma ORM |
| Auth | jsonwebtoken (JWT cookie) + bcryptjs |
| Email | nodemailer (Gmail SMTP) |
| PDF / OCR | pdf-parse (text layer), tesseract.js (OCR), pdfjs-dist + @napi-rs/canvas (rasterize), pdfkit (sample generation) |

---

## 🚀 Getting started

### 1. Prerequisites

- **Node.js 20 or newer** (project developed on Node 22) — <https://nodejs.org>
- **npm** (bundled with Node)
- **git**

> No global database server is required — the app uses a local SQLite file.
> The PDF/OCR libraries ship prebuilt native binaries, so no compiler toolchain
> is needed on Windows/macOS/Linux.

### 2. Clone & install

```bash
git clone <your-repo-url> cashflow-pro
cd cashflow-pro
npm install
```

### 3. Configure environment variables

Copy the template and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite connection string. Leave as `file:./dev.db`. |
| `JWT_SECRET` | ✅ | Any long random string — signs session tokens. |
| `SMTP_USER` | ⛔️ optional | Gmail address that sends OTP/reminder emails. |
| `SMTP_PASS` | ⛔️ optional | A Gmail **App Password** (16 chars, not your normal password). Create at Google Account → Security → 2-Step Verification → App passwords. |

> **Email is optional for local dev.** If SMTP isn't configured (or your network
> blocks outbound SMTP — common on college/office Wi-Fi), the app prints the OTP
> to the terminal so you can still sign up and test. For real emails, use a
> mobile hotspot or an SMTP-open network.

### 4. Set up the database

```bash
npx prisma generate     # generate the Prisma client
npx prisma db push      # create dev.db from the schema
npx prisma db seed      # load demo business + sample data (optional but recommended)
```

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## 🔑 Demo accounts

After seeding, log in with any of these (password for all: **`password123`**):

| Email | Role |
|---|---|
| `admin@cafebeans.test` | Admin |
| `alice@cafebeans.test` | Accountant |
| `bob@cafebeans.test` | Viewer |

They share one business ("Cafe Beans"), so you can see RBAC in action.

---

## 📜 npm scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run gen:samples` | Generate sample invoice/bill PDFs into `sample-docs/` for testing the import feature |
| `npx prisma studio` | Visual database browser (<http://localhost:5555>) |
| `npx prisma db seed` | Reseed the demo data |

---

## 🗂️ Project structure

```
prisma/
  schema.prisma        # data model (User, Contact, Invoice, Bill, Transaction, Budget)
  seed.ts              # demo seed (uses the ledger generator)
scripts/
  generate-sample-docs.ts   # sample invoice/bill PDF generator
src/
  proxy.ts             # auth gate (redirects unauthenticated requests)
  app/
    api/               # backend route handlers (auth, invoices, bills, contacts,
                       #   team, import, bank, data, user…)
    (pages)            # dashboard, invoices, bills, analytics, contacts,
                       #   profile, settings, login, signup, onboarding
  components/          # Header, Sidebar, Tooltip, ImportDocs, PasswordResetForm…
  lib/
    auth.ts            # session + tenant helpers
    rbac.ts            # role guards
    prisma.ts          # Prisma singleton
    constants.ts       # domain vocabulary (states, aging, totals)
    analytics.ts       # cash-flow statement, forecast, budget vs actuals
    demoData.ts        # 90-day industry-aware ledger generator
    extract.ts         # local PDF invoice/bill extraction (text + OCR)
    mailer.ts          # OTP / reminder email (IPv4-forced)
    format.ts          # currency + initials helpers
```

---

## 📝 Notes

- **All financial figures are demo/sample data** — the app is a functional
  prototype, not connected to real banks. "Connect Bank" generates a realistic
  synthetic ledger.
- **Security**: never commit your real `.env` (it's gitignored). Rotate any Gmail
  App Password that has been shared.
- To reset to a clean slate: **Settings → Clear All Business Data**, or re-run
  `npx prisma db seed`.
