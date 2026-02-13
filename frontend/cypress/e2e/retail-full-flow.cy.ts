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

    cy.intercept('GET', '**/football/**', {
      statusCode: 200,
      body: emptyApiFootball,
    });

    cy.intercept('GET', '**/bets/my', {
      statusCode: 200,
      body: { ok: true, bets: [] },
    });

    cy.intercept('POST', '**/betslip/place-retail*', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        booking: {
          bookCode: '11-030686',
          createdAt: '2026-02-13T10:00:00.000Z',
        },
        mode: 'single',
        totalStake: 10,
        totalPotentialPayout: 21,
        lineCount: 1,
      },
    }).as('bookCode');

    cy.intercept('GET', '**/retail/my/tickets*', {
      statusCode: 200,
      body: {
        ok: true,
        tickets: [{ ticketId: '22-998877', status: 'claimed', sourceBookCode: '11-030686' }],
      },
    }).as('myTickets');

    cy.intercept('GET', '**/retail/my/reports/summary*', {
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
    }).as('report');

    cy.intercept('POST', '**/retail/tickets/issue', {
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

    cy.intercept('GET', '**/retail/tickets/22-998877', {
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

    cy.intercept('GET', '**/tickets/11-030686/recreate', {
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
    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-primary-action"]', { timeout: 20000 })
        .should('contain.text', 'Book a Bet')
        .first()
        .click();
    });

    cy.wait('@bookCode', { timeout: 20000 });
    cy.contains('11-030686', { timeout: 20000 }).should('be.visible');

    cy.visit('/retail/dashboard?tab=work', {
      onBeforeLoad(win) {
        win.localStorage.setItem('retailAuthToken', 'retail-token-test');
        stubPopup(win);
      },
    });

    cy.get('input[placeholder="Enter book code"]', { timeout: 20000 }).type('11-030686');
    cy.contains('button', 'Issue').first().click();

    cy.wait('@issueTicket', { timeout: 20000 });
    cy.wait('@lookupIssued', { timeout: 20000 });
    cy.wait('@recreateBooking', { timeout: 20000 });
    cy.wait('@myTickets', { timeout: 20000 });
    cy.wait('@report', { timeout: 20000 });

    cy.contains('22-998877', { timeout: 20000 }).should('be.visible');
    cy.contains('Claimed').should('be.visible');

    cy.contains('a', 'Data').click();
    cy.contains('Total Stake').parent().contains('Br10.00');
    cy.contains('Net Profit').parent().contains('Br10.00');
    cy.contains('Tickets: 1').should('be.visible');
    cy.contains('Claimed: 1').should('be.visible');
  });
});
