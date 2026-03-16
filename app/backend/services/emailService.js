const nodemailer = require('nodemailer');

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: parseInt(SMTP_PORT || '587') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

async function sendRfpStatusEmail(rfp, status, notes, company) {
  if (!rfp.email) return;
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Email] SMTP not configured, skipping email notification');
    return;
  }

  const totalAmount = (rfp.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

  const STATUS_INFO = {
    APPROVED: { subject: '✅ Request for Payment Disetujui', color: '#16a34a', badge: 'DISETUJUI', message: 'Request for payment Anda telah <strong>disetujui</strong> oleh tim finance.' },
    VERIFIED: { subject: '🔍 Request for Payment Diverifikasi', color: '#2563eb', badge: 'DIVERIFIKASI', message: 'Request for payment Anda telah <strong>diverifikasi</strong> oleh tim finance dan sedang menunggu persetujuan akhir.' },
    REJECTED: { subject: '❌ Request for Payment Ditolak', color: '#dc2626', badge: 'DITOLAK', message: 'Request for payment Anda <strong>tidak dapat diproses</strong>. Silakan hubungi tim finance untuk informasi lebih lanjut.' },
  };

  const info = STATUS_INFO[status];
  if (!info) return;

  const companyName = company?.name || 'Tim Finance';
  const itemRows = (rfp.items || []).map((item, i) =>
    `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${fmt(item.amount)}</td>
    </tr>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#1a3557;padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">${companyName}</h1>
      <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Notifikasi Request for Payment</p>
    </div>

    <!-- Status Badge -->
    <div style="padding:24px 32px 0">
      <div style="display:inline-block;background:${info.color};color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:1px">
        ${info.badge}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:20px 32px">
      <p style="color:#374151;font-size:15px;margin-top:0">Halo <strong>${rfp.name}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">${info.message}</p>

      <!-- Request Info -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="color:#6b7280;padding:4px 0;width:140px">No. RFP</td>
            <td style="color:#111827;font-weight:600">${rfp.number}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 0">Tanggal</td>
            <td style="color:#111827">${fmtDate(rfp.date)}</td>
          </tr>
          ${rfp.project ? `<tr><td style="color:#6b7280;padding:4px 0">Proyek</td><td style="color:#111827">${rfp.project}</td></tr>` : ''}
          ${rfp.detailsOfPayment ? `<tr><td style="color:#6b7280;padding:4px 0">Keperluan</td><td style="color:#111827">${rfp.detailsOfPayment}</td></tr>` : ''}
        </table>
      </div>

      <!-- Items Table -->
      <p style="font-size:13px;font-weight:600;color:#1a3557;margin-bottom:8px">Rincian Pembayaran</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1a3557">
            <th style="padding:10px 12px;text-align:left;color:#fff;font-weight:600">Deskripsi</th>
            <th style="padding:10px 12px;text-align:right;color:#fff;font-weight:600">Jumlah</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#1a3557">
            <td style="padding:10px 12px;color:#fff;font-weight:700">TOTAL</td>
            <td style="padding:10px 12px;text-align:right;color:#fff;font-weight:700">${fmt(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      ${notes ? `
      <div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
        <p style="margin:0;font-size:13px;color:#92400e"><strong>Catatan dari Finance:</strong><br>${notes}</p>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px 24px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#9ca3af">Email ini dikirim otomatis oleh sistem ${companyName}. Jangan membalas email ini.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: rfp.email,
      subject: `${info.subject} — ${rfp.number}`,
      html,
    });
    console.log(`[Email] Sent ${status} notification to ${rfp.email}`);
  } catch (e) {
    console.error('[Email] Failed to send:', e.message);
  }
}

module.exports = { sendRfpStatusEmail };
