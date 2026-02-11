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
          {
            id: '1002-1-Away',
            fixtureId: 1002,
            betId: 1,
            value: 'Away',
            odd: 1.8,
            bookmakerId: 8,
            fixtureName: 'Liverpool vs Spurs',
            marketName: 'Match Winner',
            selectionName: 'Spurs',
            odds: 1.8,
            leagueName: 'Premier League',
            leagueCountry: 'England',
            fixtureDate: '2026-02-14T16:00:00.000Z',
          },
        ],
      },
      version: 0,
    }),
  );
};

const visitWithSeededBetSlip = (options?: { withAuthToken?: boolean }) => {
  cy.visit('/play/betslip', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.removeItem('authToken');
      win.localStorage.removeItem('retailAuthToken');
      seedBetSlip(win);
      if (options?.withAuthToken) {
        win.localStorage.setItem('authToken', 'token-123');
      }
    },
  });
  cy.contains('Arsenal - Chelsea', { timeout: 20000 }).should('exist');
};

describe('Bet Slip E2E', () => {
  beforeEach(() => {
    cy.viewport(390, 844);

    // Prevent noisy background traffic from sidebar/home widgets in layout.
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
  });

  it('shows Book a Bet for guests and returns short booking code', () => {
    cy.intercept('POST', '**/api/betslip/validate*', {
      statusCode: 200,
      body: {
        ok: true,
        mode: 'multiple',
        lines: [{ key: 'line_1', stake: 10, potentialPayout: 37.8, selections: 2 }],
        totalPotentialPayout: 37.8,
        results: [{ ok: true }, { ok: true }],
      },
    }).as('validate');

    cy.intercept('POST', '**/api/betslip/place-retail*', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        ticket: { ticketId: '11-030686' },
      },
    }).as('placeRetail');
    cy.intercept('POST', '**/api/tickets*', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        ticket: { ticketId: '11-030686' },
      },
    }).as('placeRetail');

    visitWithSeededBetSlip();

    cy.contains('button', 'Book a Bet', { timeout: 20000 })
      .should('not.be.disabled')
      .click();

    cy.contains('Bet Booked', { timeout: 30000 }).should('be.visible');
    cy.contains('11-030686', { timeout: 30000 }).should('be.visible');
    cy.contains('a', 'Share Bet Link')
      .should('have.attr', 'href')
      .and('include', '/play/betslip?book=11-030686');
  });

  it('places wallet bet when balance is sufficient', () => {
    cy.intercept('GET', '**/api/wallet/profile', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          userData: {
            username: 'cashier',
            realBalance: 500,
          },
        },
      },
    }).as('walletProfile');

    cy.intercept('POST', '**/api/betslip/validate*', {
      statusCode: 200,
      body: {
        ok: true,
        mode: 'multiple',
        lines: [{ key: 'line_1', stake: 10, potentialPayout: 37.8, selections: 2 }],
        totalPotentialPayout: 37.8,
        results: [{ ok: true }, { ok: true }],
      },
    }).as('validate');

    cy.intercept('POST', '**/api/betslip/place*', {
      statusCode: 200,
      body: {
        ok: true,
        ticket: {
          ticketRef: 'bet_1700000000000_abcd12',
        },
      },
    }).as('placeWallet');

    visitWithSeededBetSlip({ withAuthToken: true });
    cy.contains('Br500.00', { timeout: 20000 }).should('exist');
    cy.contains('button', 'Place Bet')
      .should('not.be.disabled')
      .click();

    cy.contains('Wallet Bet Placed', { timeout: 30000 }).should('be.visible');
    cy.contains('bet_1700000000000_abcd12', { timeout: 30000 }).should('be.visible');
  });

  it('blocks wallet bet when balance is insufficient', () => {
    cy.intercept('GET', '**/api/wallet/profile', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          userData: {
            username: 'cashier',
            realBalance: 5,
          },
        },
      },
    }).as('walletProfile');

    cy.intercept('POST', '**/api/betslip/place*').as('placeWallet');

    visitWithSeededBetSlip({ withAuthToken: true });
    cy.contains('button', 'Place Bet', { timeout: 20000 }).click();

    cy.contains('Insufficient balance').should('be.visible');
    cy.get('@placeWallet.all').should('have.length', 0);
  });

  it('recreates selections from a shared booking link', () => {
    cy.intercept('GET', '**/api/tickets/11-030686/recreate', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        slip: { stake: 25, mode: 'multiple' },
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
          {
            id: '1002-1-Away',
            fixtureId: 1002,
            betId: 1,
            value: 'Away',
            odd: 1.8,
            bookmakerId: 8,
            fixtureName: 'Liverpool vs Spurs',
            marketName: 'Match Winner',
            selectionName: 'Spurs',
            odds: 1.8,
            leagueName: 'Premier League',
            leagueCountry: 'England',
            fixtureDate: '2026-02-14T16:00:00.000Z',
          },
        ],
      },
    }).as('recreate');

    cy.visit('/play/betslip?book=11-030686', {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });

    cy.wait('@recreate', { timeout: 20000 });
    cy.contains('Shared bet 11-030686 loaded.').should('be.visible');
    cy.contains('Arsenal - Chelsea', { timeout: 20000 }).should('exist');
    cy.contains('Liverpool - Spurs', { timeout: 20000 }).should('exist');
  });
});
