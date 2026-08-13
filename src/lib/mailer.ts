import nodemailer, { type Transporter } from 'nodemailer';
import dns from 'dns';

// Prefer IPv4 results globally. Many networks (and several Indian ISPs) have no
// working IPv6 route, so connecting to Gmail's AAAA record fails with
// ENETUNREACH after a long hang.
dns.setDefaultResultOrder('ipv4first');

const SMTP_HOST = 'smtp.gmail.com';

let cachedTransporter: Transporter | null = null;

/**
 * Build (and cache) a nodemailer transporter that is forced onto IPv4.
 *
 * We resolve the SMTP host to an A (IPv4) record ourselves and connect to that
 * address directly, while keeping `tls.servername` pointed at the real hostname
 * so the TLS certificate still validates. This is more reliable than the
 * `family: 4` option, which nodemailer does not consistently pass through to the
 * underlying TLS socket.
 */
export async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER / SMTP_PASS are not configured in the environment');
  }

  const { address: ipv4Address } = await dns.promises.lookup(SMTP_HOST, { family: 4 });

  cachedTransporter = nodemailer.createTransport({
    host: ipv4Address,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Keep SNI / certificate validation tied to the real hostname even though we
    // dialed the raw IPv4 address.
    tls: { servername: SMTP_HOST },
    // Fail fast instead of hanging ~22s on an unreachable network.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return cachedTransporter;
}

/**
 * Generic send. Returns `{ sent }` — `false` means it fell back to a dev log
 * (e.g. SMTP blocked on this network) rather than actually delivering. Throws
 * only in production so failures surface there.
 */
export async function sendMail(opts: { to: string; subject: string; text: string; html: string }): Promise<{ sent: boolean }> {
  try {
    const transporter = await getTransporter();
    await transporter.sendMail({ from: `"CashFlow Pro" <${process.env.SMTP_USER}>`, ...opts });
    return { sent: true };
  } catch (err) {
    // Many networks (college/office/ISP firewalls) block outbound SMTP ports
    // entirely. In development we log instead of failing the request.
    if (process.env.NODE_ENV === 'production') throw err;
    console.warn(`\n[mailer] Could not send email (likely SMTP blocked).` +
      `\n[mailer] DEV FALLBACK — to: ${opts.to} | subject: ${opts.subject}\n`);
    return { sent: false };
  }
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const { sent } = await sendMail({
    to,
    subject: 'Verify your CashFlow Pro account',
    text: `Your CashFlow Pro verification code is: ${otp}. It expires in 10 minutes.`,
    html: `<h3>Welcome to CashFlow Pro!</h3><p>Your 6-digit verification code is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`,
  });
  if (!sent && process.env.NODE_ENV !== 'production') {
    console.warn(`[mailer] DEV FALLBACK — OTP for ${to} is: ${otp}`);
  }
}

/** A payment-reminder email for an outstanding invoice. */
export async function sendInvoiceReminder(opts: {
  to: string; customerName: string; businessName: string; invoiceNumber: string;
  amountLabel: string; dueDateLabel: string; daysOverdue: number;
}): Promise<{ sent: boolean }> {
  const { to, customerName, businessName, invoiceNumber, amountLabel, dueDateLabel, daysOverdue } = opts;
  const overdueLine = daysOverdue > 0
    ? `This invoice is <strong>${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</strong>.`
    : `This is a friendly reminder ahead of the due date.`;
  return sendMail({
    to,
    subject: `Payment reminder: Invoice ${invoiceNumber} from ${businessName}`,
    text: `Dear ${customerName},\n\nThis is a reminder for invoice ${invoiceNumber} of ${amountLabel}, due ${dueDateLabel}. ${daysOverdue > 0 ? `It is ${daysOverdue} day(s) overdue.` : ''}\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n${businessName}`,
    html: `<p>Dear ${customerName},</p><p>This is a reminder regarding invoice <strong>${invoiceNumber}</strong> for <strong>${amountLabel}</strong>, due on <strong>${dueDateLabel}</strong>. ${overdueLine}</p><p>Kindly arrange payment at your earliest convenience.</p><p>Warm regards,<br/>${businessName}</p>`,
  });
}
