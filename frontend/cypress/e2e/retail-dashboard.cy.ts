describe('Retail Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);

    cy.intercept('GET', '**/api/retail/my/tickets*', {
      statusCode: 200,
      body: {
        ok: true,
        tickets: [
          { ticketId: '11-030686', status: 'claimed' },
          { ticketId: '11-030687', status: 'paid' },
        ],
      },
    }).as('myTickets');

    cy.intercept('GET', '**/api/retail/my/reports/summary*', {
      statusCode: 200,
      body: {
        ok: true,
        summary: {
          from: '2026-02-01T00:00:00.000Z',
          to: '2026-02-07T23:59:59.999Z',
          totalStake: 100,
          totalPaidOut: 30,
          netProfit: 70,
          ticketsCount: 3,
          paidTicketsCount: 1,
          byStatus: {
            claimed: 1,
            paid: 1,
            settled_lost: 1,
          },
        },
      },
    }).as('report');
  });

  it('loads report summary and ticket desk actions', () => {
    cy.intercept('GET', '**/api/retail/tickets/11-030686', {
      statusCode: 200,
      body: {
        ok: true,
        ticket: {
          ticketId: '11-030686',
          status: 'open',
          sourceBookCode: '11-030686',
          createdAt: '2026-02-07T12:00:00.000Z',
          bet: {
            id: 5,
            stake: '10.00',
            status: 'pending',
            payout: null,
            selections: [
              {
                fixtureId: 1001,
                marketBetId: '1',
                value: 'Home',
                odd: '2.10',
              },
            ],
          },
        },
      },
    }).as('lookup');

    cy.intercept('GET', '**/api/tickets/11-030686/recreate', {
      statusCode: 200,
      body: {
        ok: true,
        bets: [
          {
            id: '1001-1-Home',
            fixtureName: 'Arsenal vs Chelsea',
            marketName: '1X2',
            selectionName: 'Home',
            odds: 2.1,
            fixtureDate: '2026-02-07T15:00:00.000Z',
          },
        ],
      },
    }).as('recreate');

    cy.intercept('POST', '**/api/retail/tickets/issue', {
      statusCode: 200,
      body: {
        ok: true,
        sourceBookCode: '11-030686',
        ticketBatchId: '22-998877',
        mode: 'multiple',
        lineCount: 1,
        tickets: [{ ticketId: '22-998877', status: 'claimed' }],
        bets: [
          {
            id: 9,
            stake: '10.00',
            selections: [
              {
                fixtureId: 1001,
                marketBetId: '1',
                value: 'Home',
                odd: '2.10',
              },
            ],
          },
        ],
      },
    }).as('issue');

    cy.intercept('GET', '**/api/retail/tickets/22-998877', {
      statusCode: 200,
      body: {
        ok: true,
        ticket: {
          ticketId: '22-998877',
          status: 'claimed',
          sourceBookCode: '11-030686',
          createdAt: '2026-02-07T12:00:00.000Z',
          bet: {
            id: 9,
            stake: '10.00',
            status: 'pending',
            payout: null,
            selections: [
              {
                fixtureId: 1001,
                marketBetId: '1',
                value: 'Home',
                odd: '2.10',
              },
            ],
          },
        },
      },
    }).as('lookupIssued');

    cy.visit('/retail/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('retailAuthToken', 'retail-token-test');
        const popup = {
          document: {
            open: () => undefined,
            write: () => undefined,
            close: () => undefined,
          },
          focus: () => undefined,
          print: () => undefined,
          close: () => undefined,
        };
        cy.stub(win, 'open').returns(popup as any);
      },
    });

    cy.wait('@myTickets', { timeout: 20000 });
    cy.wait('@report', { timeout: 20000 });

    cy.contains('Retail Report', { timeout: 20000 }).should('be.visible');
    cy.contains('Total Stake').parent().contains('Br100.00');
    cy.contains('Net Profit').parent().contains('Br70.00');
    cy.contains('Tickets: 3').should('be.visible');
    cy.contains('Paid: 1').should('be.visible');

    cy.get('input[placeholder="Enter book code to issue ticket"]').type('11-030686');
    cy.contains('button', 'Issue Ticket').click();
    cy.wait('@issue', { timeout: 20000 });
    cy.wait('@lookupIssued', { timeout: 20000 });
    cy.contains('Issued Batch:').parent().contains('22-998877');

    cy.get('input[placeholder="Enter ticket ID"]').type('11-030686');
    cy.contains('button', 'Lookup').click();

    cy.wait('@lookup', { timeout: 20000 });
    cy.wait('@recreate', { timeout: 20000 });
    cy.contains('Ticket loaded', { timeout: 20000 }).should('be.visible');
    cy.contains('button', 'Print Ticket', { timeout: 20000 }).should('be.visible');
  });
});
