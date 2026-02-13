const seedBetSlip = (win: Cypress.AUTWindow) => {
  win.localStorage.setItem(
    'betslip-store-v1',
    JSON.stringify({
      state: {
        isOpen: true,
        bets: [
          {
            id: '1001-1-Home',
            fixtureId: 1001,
            betId: 1,
            value: 'Home',
            odd: 2.1,
            bookmakerId: 8,
            fixtureName: 'Arsenal vs Chelsea',
            marketName: 'Match Winner',
            selectionName: 'Arsenal',
            odds: 2.1,
            leagueName: 'Premier League',
            leagueCountry: 'England',
            fixtureDate: '2026-02-13T18:30:00.000Z',
          },
        ],
      },
      version: 0,
    }),
  );
};

const stubPopup = (win: Cypress.AUTWindow) => {
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
};

describe('Retail Full E2E Flow', () => {
  it('books a bet code, issues as claimed ticket, and updates report totals', () => {
    const emptyApiFootball = {
      get: 'mock',
      parameters: {},
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    };

    cy.intercept('GET', '**/api/football/**', {
      statusCode: 200,
      body: emptyApiFootball,
    });

    cy.intercept('GET', '**/api/bets/my', {
      statusCode: 200,
      body: { ok: true, bets: [] },
    });

    cy.intercept('POST', '**/api/betslip/validate*', {
      statusCode: 200,
      body: {
        ok: true,
        mode: 'single',
        lines: [{ key: 'line_1', stake: 10, potentialPayout: 21, selections: 1 }],
        totalPotentialPayout: 21,
        results: [{ ok: true }],
      },
    }).as('validateSlip');

    cy.intercept('POST', '**/api/betslip/place-retail*', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        booking: {
          id: 9,
          bookCode: '11-030686',
          createdAt: '2026-02-13T10:00:00.000Z',
        },
        mode: 'single',
        totalStake: 10,
        totalPotentialPayout: 21,
        lineCount: 1,
      },
    }).as('bookCode');

    let myTicketsCalls = 0;
    cy.intercept('GET', '**/api/retail/my/tickets*', (req) => {
      myTicketsCalls += 1;
      if (myTicketsCalls === 1) {
        req.reply({ statusCode: 200, body: { ok: true, tickets: [] } });
        return;
      }
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          tickets: [{ ticketId: '22-998877', status: 'claimed', sourceBookCode: '11-030686' }],
        },
      });
    }).as('myTickets');

    let reportCalls = 0;
    cy.intercept('GET', '**/api/retail/my/reports/summary*', (req) => {
      reportCalls += 1;
      if (reportCalls === 1) {
        req.reply({
          statusCode: 200,
          body: {
            ok: true,
            summary: {
              from: '2026-02-01T00:00:00.000Z',
              to: '2026-02-07T23:59:59.999Z',
              totalStake: 0,
              totalPaidOut: 0,
              netProfit: 0,
              ticketsCount: 0,
              paidTicketsCount: 0,
              byStatus: {},
            },
          },
        });
        return;
      }
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          summary: {
            from: '2026-02-01T00:00:00.000Z',
            to: '2026-02-07T23:59:59.999Z',
            totalStake: 10,
            totalPaidOut: 0,
            netProfit: 10,
            ticketsCount: 1,
            paidTicketsCount: 0,
            byStatus: { claimed: 1 },
          },
        },
      });
    }).as('report');

    cy.intercept('POST', '**/api/retail/tickets/issue', {
      statusCode: 200,
      body: {
        ok: true,
        sourceBookCode: '11-030686',
        ticketBatchId: '22-998877',
        mode: 'single',
        totalStake: 10,
        totalPotentialPayout: 21,
        lineCount: 1,
        issuedByRetailerId: 1,
        tickets: [
          {
            ticketId: '22-998877',
            status: 'claimed',
            sourceBookCode: '11-030686',
            claimedByRetailerId: 1,
            claimedAt: '2026-02-13T10:02:00.000Z',
          },
        ],
        bets: [
          {
            id: 123,
            stake: '10.00',
            status: 'pending',
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
    }).as('issueTicket');

    cy.intercept('GET', '**/api/retail/tickets/22-998877', {
      statusCode: 200,
      body: {
        ok: true,
        ticket: {
          ticketId: '22-998877',
          status: 'claimed',
          sourceBookCode: '11-030686',
          createdAt: '2026-02-13T10:02:00.000Z',
          bet: {
            id: 123,
            stake: '10.00',
            status: 'pending',
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

    cy.intercept('GET', '**/api/tickets/11-030686/recreate', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        slip: {
          selections: [
            { fixtureId: 1001, betId: 1, value: 'Home', odd: 2.1, bookmakerId: 8 },
          ],
          stake: 10,
          mode: 'single',
        },
        bets: [
          {
            id: '1001-1-Home',
            fixtureId: 1001,
            betId: 1,
            value: 'Home',
            odd: 2.1,
            bookmakerId: 8,
            fixtureName: 'Arsenal vs Chelsea',
            marketName: '1X2',
            selectionName: 'Home',
            odds: 2.1,
            fixtureDate: '2026-02-13T18:30:00.000Z',
          },
        ],
      },
    }).as('recreateBooking');

    cy.visit('/play/betslip', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.removeItem('authToken');
        win.localStorage.removeItem('retailAuthToken');
        seedBetSlip(win);
        stubPopup(win);
      },
    });

    cy.get('[data-testid="betslip-page"]', { timeout: 20000 }).should('be.visible');
    cy.get('[data-testid="betslip-primary-action"]', { timeout: 20000 })
      .should('contain.text', 'Book a Bet')
      .first()
      .click({ force: true });

    cy.wait('@validateSlip', { timeout: 20000 });
    cy.wait('@bookCode', { timeout: 20000 });
    cy.contains('11-030686', { timeout: 20000 }).should('be.visible');

    cy.visit('/retail/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('retailAuthToken', 'retail-token-test');
        stubPopup(win);
      },
    });

    cy.wait('@myTickets', { timeout: 20000 });
    cy.wait('@report', { timeout: 20000 });

    cy.get('input[placeholder="Enter book code to issue ticket"]', { timeout: 20000 }).type('11-030686');
    cy.contains('button', 'Issue Ticket').first().click();

    cy.wait('@issueTicket', { timeout: 20000 });
    cy.wait('@lookupIssued', { timeout: 20000 });
    cy.wait('@recreateBooking', { timeout: 20000 });
    cy.wait('@myTickets', { timeout: 20000 });
    cy.wait('@report', { timeout: 20000 });

    cy.contains('Issued Batch:', { timeout: 20000 }).parent().contains('22-998877');
    cy.contains('Status:').parent().contains('claimed');
    cy.contains('Source Code:').parent().contains('11-030686');
    cy.contains('Total Stake').parent().contains('Br10.00');
    cy.contains('Net Profit').parent().contains('Br10.00');
    cy.contains('Tickets: 1').should('be.visible');
    cy.contains('claimed: 1').should('be.visible');
  });
});
