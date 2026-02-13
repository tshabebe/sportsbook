import { describe, expect, it } from 'vitest';
import { buildRetailTicketPrintHtml } from './retailPrint';

describe('buildRetailTicketPrintHtml', () => {
  it('renders core ticket fields and selections', () => {
    const html = buildRetailTicketPrintHtml({
      title: 'Book A Bet',
      ticketCode: '11-030686',
      printedAt: '2026-02-13T11:22:33.000Z',
      mode: 'single',
      stake: 10,
      potentialPayout: 33,
      status: 'open',
      selections: [
        {
          fixtureName: 'Arsenal vs Chelsea',
          marketName: '1X2',
          selectionName: 'Home',
          odds: 3.3,
          fixtureDate: '2026-02-13T18:00:00.000Z',
        },
      ],
    });

    expect(html).toContain('11-030686');
    expect(html).toContain('Book A Bet');
    expect(html).toContain('Arsenal vs Chelsea');
    expect(html).toContain('1X2');
    expect(html).toContain('Home');
    expect(html).toContain('3.30');
  });

  it('escapes user controlled fields', () => {
    const html = buildRetailTicketPrintHtml({
      title: '<script>alert(1)</script>',
      ticketCode: '11-030686',
      printedAt: '2026-02-13T11:22:33.000Z',
      mode: 'single',
      stake: 1,
      potentialPayout: 2,
      selections: [
        {
          fixtureName: '<b>Fixture</b>',
          marketName: '1X2',
          selectionName: 'Home',
          odds: 2,
        },
      ],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Fixture&lt;/b&gt;');
  });
});
