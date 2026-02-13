import { formatCurrency } from '../config/currency';

type PrintSelection = {
  fixtureName: string;
  marketName: string;
  selectionName: string;
  odds: number;
  fixtureDate?: string;
};

type PrintTicketInput = {
  title: string;
  ticketCode: string;
  printedAt: string;
  mode: string;
  stake: number;
  potentialPayout: number;
  status?: string;
  selections: PrintSelection[];
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const buildRetailTicketPrintHtml = (ticket: PrintTicketInput): string => {
  const lines = ticket.selections
    .map((selection, index) => {
      const fixtureDate = selection.fixtureDate ? formatDate(selection.fixtureDate) : null;
      return `
        <tr>
          <td class="index">${index + 1}</td>
          <td>
            <div class="fixture">${escapeHtml(selection.fixtureName)}</div>
            ${fixtureDate ? `<div class="meta">${escapeHtml(fixtureDate)}</div>` : ''}
            <div class="meta">${escapeHtml(selection.marketName)} • ${escapeHtml(selection.selectionName)}</div>
          </td>
          <td class="odds">${Number(selection.odds).toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Retail Ticket ${escapeHtml(ticket.ticketCode)}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: "Arial", sans-serif; font-size: 12px; color: #111; background: #fff; }
    .wrapper { width: 68mm; margin: 0 auto; }
    .top { text-align: center; border-bottom: 1px dashed #888; padding-bottom: 8px; margin-bottom: 8px; }
    .title { font-size: 15px; font-weight: 700; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.03em; }
    .code { font-size: 18px; font-weight: 800; letter-spacing: 0.03em; }
    .meta { color: #444; font-size: 11px; margin-top: 2px; }
    .summary { border-bottom: 1px dashed #888; padding-bottom: 6px; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 3px 0; }
    .label { color: #444; }
    .value { font-weight: 700; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; font-size: 11px; color: #444; border-bottom: 1px solid #ddd; padding: 4px 0; }
    th:last-child, td.odds { text-align: right; }
    td { padding: 5px 0; vertical-align: top; border-bottom: 1px dotted #e1e1e1; }
    td.index { width: 14px; color: #666; }
    .fixture { font-weight: 700; line-height: 1.25; }
    .footer { border-top: 1px dashed #888; padding-top: 7px; text-align: center; color: #555; font-size: 10px; }
  </style>
</head>
<body>
  <main class="wrapper">
    <section class="top">
      <p class="title">${escapeHtml(ticket.title)}</p>
      <div class="code">${escapeHtml(ticket.ticketCode)}</div>
      <div class="meta">Printed ${escapeHtml(formatDate(ticket.printedAt))}</div>
    </section>

    <section class="summary">
      <div class="row"><span class="label">Type</span><span class="value">${escapeHtml(ticket.mode)}</span></div>
      <div class="row"><span class="label">Stake</span><span class="value">${escapeHtml(formatCurrency(ticket.stake))}</span></div>
      <div class="row"><span class="label">Max Win</span><span class="value">${escapeHtml(formatCurrency(ticket.potentialPayout))}</span></div>
      ${ticket.status ? `<div class="row"><span class="label">Status</span><span class="value">${escapeHtml(ticket.status)}</span></div>` : ''}
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Selection</th>
          <th>Odds</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>

    <section class="footer">
      Keep this ticket safe. Required for claim and payout.
    </section>
  </main>
</body>
</html>`;
};

export const printRetailTicket = (ticket: PrintTicketInput): boolean => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
  if (!popup) return false;

  popup.document.open();
  popup.document.write(buildRetailTicketPrintHtml(ticket));
  popup.document.close();

  window.setTimeout(() => {
    popup.focus();
    popup.print();
    popup.close();
  }, 150);

  return true;
};

export type { PrintSelection, PrintTicketInput };
