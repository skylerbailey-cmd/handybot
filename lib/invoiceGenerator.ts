import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { BusinessProfile } from "./businessProfile";
import type { Home } from "./homes";
import { formatMoney } from "./theme";
import type { Issue } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(ms?: number): string {
  const d = ms ? new Date(ms) : new Date();
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function invoiceNumber(issue: Issue): string {
  const d = new Date(issue.updatedAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}-${issue.id.slice(0, 6).toUpperCase()}`;
}

interface InvoiceArgs {
  issue: Issue;
  recipient: string;
  hoursWorked: number;
  note?: string;
  profile: BusinessProfile;
  home?: Home;
}

function buildHtml(args: InvoiceArgs): string {
  const { issue, recipient, hoursWorked, note, profile, home } = args;

  // Line items
  const lines: Array<{ desc: string; amount: number }> = [];

  // Labor
  if (hoursWorked > 0 && profile.hourlyRateUsd > 0) {
    const laborTotal = hoursWorked * profile.hourlyRateUsd;
    lines.push({
      desc: `Labor: ${hoursWorked} hr${hoursWorked !== 1 ? "s" : ""} @ ${formatMoney(profile.hourlyRateUsd)}/hr`,
      amount: laborTotal,
    });
  }

  // Materials (only items marked 'have' with a price)
  const materials = (issue.plan.materials ?? []).filter(
    (m) => m.have && m.estimatedPriceUsd && m.estimatedPriceUsd > 0
  );
  for (const m of materials) {
    lines.push({
      desc: `${m.name} (${m.quantity})`,
      amount: m.estimatedPriceUsd!,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxRate = profile.taxRatePercent > 0 ? profile.taxRatePercent : 0;
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax;

  const lineRowsHtml = lines
    .map(
      (l) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">${esc(l.desc)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;width:100px;">${formatMoney(l.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1c1917; padding:40px; font-size:14px; }
    .header { display:flex; justify-content:space-between; margin-bottom:32px; }
    .biz-name { font-size:22px; font-weight:800; color:#ea580c; }
    .biz-detail { font-size:12px; color:#78716c; margin-top:2px; }
    .invoice-label { font-size:28px; font-weight:900; color:#1c1917; text-align:right; }
    .invoice-num { font-size:13px; color:#78716c; text-align:right; margin-top:4px; }
    .meta-row { display:flex; justify-content:space-between; margin-bottom:24px; }
    .meta-box { background:#fafaf9; border:1px solid #e7e5e4; border-radius:8px; padding:12px 16px; flex:1; }
    .meta-box + .meta-box { margin-left:16px; }
    .meta-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#a8a29e; }
    .meta-value { font-size:14px; font-weight:600; margin-top:4px; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; }
    th { text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#a8a29e; padding-bottom:8px; border-bottom:2px solid #1c1917; }
    th.right { text-align:right; }
    .totals td { padding:6px 0; font-size:14px; }
    .totals .grand { font-size:18px; font-weight:900; border-top:2px solid #1c1917; padding-top:12px; }
    .notes { background:#fafaf9; border-radius:8px; padding:16px; margin-top:24px; }
    .notes-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#a8a29e; margin-bottom:4px; }
    .notes-body { font-size:13px; color:#44403c; line-height:1.5; }
    .footer { margin-top:40px; text-align:center; font-size:12px; color:#a8a29e; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="biz-name">${esc(profile.businessName)}</div>
      ${profile.address ? `<div class="biz-detail">${esc(profile.address)}</div>` : ""}
      ${profile.phone ? `<div class="biz-detail">${esc(profile.phone)}</div>` : ""}
      ${profile.email ? `<div class="biz-detail">${esc(profile.email)}</div>` : ""}
    </div>
    <div>
      <div class="invoice-label">INVOICE</div>
      <div class="invoice-num">#${invoiceNumber(issue)}</div>
      <div class="invoice-num">${fmtDate()}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-box">
      <div class="meta-label">Bill to</div>
      <div class="meta-value">${esc(recipient)}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Property</div>
      <div class="meta-value">${esc(home?.address || home?.name || "—")}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-box">
      <div class="meta-label">Work performed</div>
      <div class="meta-value">${esc(issue.title)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRowsHtml}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td>Subtotal</td>
      <td style="text-align:right;width:100px;">${formatMoney(subtotal)}</td>
    </tr>
    ${taxRate > 0 ? `
    <tr>
      <td>Tax (${taxRate}%)</td>
      <td style="text-align:right;width:100px;">${formatMoney(tax)}</td>
    </tr>` : ""}
    <tr>
      <td class="grand">Total due</td>
      <td class="grand" style="text-align:right;width:100px;">${formatMoney(total)}</td>
    </tr>
  </table>

  ${(issue.summary || note) ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    <div class="notes-body">
      ${issue.summary ? esc(issue.summary) : ""}
      ${issue.summary && note ? "<br/><br/>" : ""}
      ${note ? esc(note) : ""}
    </div>
  </div>` : ""}

  <div class="footer">
    Due in 30 days${profile.phone ? ` · ${esc(profile.phone)}` : ""}${profile.email ? ` · ${esc(profile.email)}` : ""}
  </div>
</body>
</html>`;
}

/**
 * Generate an invoice PDF and return the file URI.
 */
export async function generateInvoicePdf(
  args: InvoiceArgs
): Promise<string> {
  const html = buildHtml(args);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Generate and share an invoice PDF via the system share sheet.
 */
export async function shareInvoicePdf(args: InvoiceArgs): Promise<void> {
  const uri = await generateInvoicePdf(args);
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Invoice — ${args.issue.title}`,
  });
}
