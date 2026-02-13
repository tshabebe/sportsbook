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
  cy.get('[data-testid="betslip-page"]', { timeout: 20000 }).should('be.visible');
  cy.get('[data-testid="betslip-page"]').within(() => {
    cy.get('[data-testid="betslip-selection-row"]', { timeout: 20000 }).should(
      'have.length.at.least',
      1,
    );
  });
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

    cy.intercept('GET', '**/football/**', {
      statusCode: 200,
      body: emptyApiFootball,
    });

    cy.intercept('GET', '**/bets/my', {
      statusCode: 200,
      body: { ok: true, bets: [] },
    });
  });

  it('shows Book a Bet for guests and returns short booking code', () => {
    cy.intercept('POST', '**/betslip/place-retail*', {
      statusCode: 200,
      body: {
        ok: true,
        bookCode: '11-030686',
        ticket: { ticketId: '11-030686' },
      },
    }).as('placeRetail');

    visitWithSeededBetSlip();

    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-primary-action"]:visible', { timeout: 20000 })
        .should('have.length', 1)
        .should('contain.text', 'Book a Bet')
        .should('not.be.disabled')
        .click({ force: true });
    });
    cy.wait('@placeRetail', { timeout: 30000 });
    cy.contains('Book A Bet Code:', { timeout: 30000 }).should('be.visible');
    cy.contains('11-030686', { timeout: 30000 }).should('be.visible');
    cy.contains('button', 'Share', { timeout: 30000 }).should('be.visible');
  });

  it('places wallet bet when balance is sufficient', () => {
    cy.intercept('GET', '**/wallet/profile', {
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

    cy.intercept('POST', '**/betslip/place*', {
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
    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-primary-action"]:visible', { timeout: 20000 })
        .should('have.length', 1)
        .should('contain.text', 'Place Bet')
        .should('not.be.disabled')
        .click({ force: true });
    });

    cy.wait('@placeWallet', { timeout: 30000 });
    cy.contains('Bet Placed', { timeout: 30000 }).should('be.visible');
    cy.contains('bet_1700000000000_abcd12', { timeout: 30000 }).should('be.visible');
  });

  it('blocks wallet bet when balance is insufficient', () => {
    cy.intercept('GET', '**/wallet/profile', {
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

    cy.intercept('POST', '**/betslip/place*').as('placeWallet');

    visitWithSeededBetSlip({ withAuthToken: true });
    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-primary-action"]:visible', { timeout: 20000 })
        .should('have.length', 1)
        .should('contain.text', 'Place Bet')
        .click({ force: true });
      cy.contains('Insufficient balance').should('be.visible');
    });
    cy.get('@placeWallet.all').should('have.length', 0);
  });

  it('recreates selections from share query on /play/betslip', () => {
    cy.intercept('GET', '**/tickets/11-030686/recreate', {
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
        ],
      },
    }).as('recreateFromShare');

    cy.visit('/play/betslip?share=11-030686', {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });

    cy.wait('@recreateFromShare', { timeout: 20000 });
    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-selection-row"]', { timeout: 20000 }).should(
        'have.length.at.least',
        1,
      );
      cy.contains(/Arsenal - Chelsea/i, { timeout: 20000 }).should('exist');
    });
  });

  it('shows authenticated wallet bets inside My Bets tab', () => {
    cy.intercept('GET', '**/bets/my', {
      statusCode: 200,
      body: {
        ok: true,
        bets: [
          {
            id: 101,
            betRef: 'bet_1700000000000_abcd12',
            userId: 1,
            username: 'cashier',
            stake: '15',
            status: 'pending',
            createdAt: '2026-02-12T12:00:00.000Z',
            selections: [],
          },
        ],
      },
    }).as('myBets');

    visitWithSeededBetSlip({ withAuthToken: true });
    cy.wait('@myBets', { timeout: 20000 });
    cy.get('[data-testid="betslip-page"]').within(() => {
      cy.get('[data-testid="betslip-tab-mybets"]', { timeout: 20000 })
        .first()
        .click({ force: true });
      cy.contains('Wallet Bets', { timeout: 20000 }).should('be.visible');
      cy.contains('bet_170000...').should('be.visible');
    });
  });
});
