const wrapApiFootball = (response: unknown) => ({
  get: 'mock',
  parameters: {},
  errors: [],
  results: Array.isArray(response) ? response.length : 1,
  paging: { current: 1, total: 1 },
  response,
});

const preMatchFixture = {
  fixture: {
    id: 9001,
    timezone: 'UTC',
    date: '2026-02-16T17:00:00.000Z',
    timestamp: 1771261200,
    status: { long: 'Not Started', short: 'NS', elapsed: null },
  },
  league: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    logo: 'https://example.com/league-39.png',
    flag: 'https://example.com/flag-eng.png',
  },
  teams: {
    home: { id: 100, name: 'Alpha FC', logo: 'https://example.com/alpha.png' },
    away: { id: 200, name: 'Beta FC', logo: 'https://example.com/beta.png' },
  },
  goals: { home: null, away: null },
};

const championsFixture = {
  fixture: {
    id: 9101,
    timezone: 'UTC',
    date: '2026-02-17T19:00:00.000Z',
    timestamp: 1771354800,
    status: { long: 'Not Started', short: 'NS', elapsed: null },
  },
  league: {
    id: 2,
    name: 'UEFA Champions League',
    country: 'World',
    logo: 'https://example.com/league-2.png',
    flag: 'https://example.com/flag-world.png',
  },
  teams: {
    home: { id: 500, name: 'Gamma FC', logo: 'https://example.com/gamma.png' },
    away: { id: 600, name: 'Delta FC', logo: 'https://example.com/delta.png' },
  },
  goals: { home: null, away: null },
};

const preMatchOdds = {
  fixture: { id: 9001, date: '2026-02-16T17:00:00.000Z' },
  league: { id: 39, name: 'Premier League', country: 'England' },
  bookmakers: [
    {
      id: 8,
      name: 'Bookmaker',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          values: [
            { value: 'Home', odd: '1.80' },
            { value: 'Draw', odd: '3.20' },
            { value: 'Away', odd: '4.10' },
          ],
        },
        {
          id: 12,
          name: 'Double Chance',
          values: [
            { value: 'Home/Draw', odd: '1.22' },
            { value: 'Home/Away', odd: '1.30' },
            { value: 'Draw/Away', odd: '1.95' },
          ],
        },
        {
          id: 5,
          name: 'Over/Under',
          values: [
            { value: 'Over 2.5', odd: '1.92' },
            { value: 'Under 2.5', odd: '1.88' },
          ],
        },
        {
          id: 8,
          name: 'Both Teams To Score',
          values: [
            { value: 'Yes', odd: '1.67' },
            { value: 'No', odd: '2.10' },
          ],
        },
      ],
    },
  ],
};

const championsOdds = {
  fixture: { id: 9101, date: '2026-02-17T19:00:00.000Z' },
  league: { id: 2, name: 'UEFA Champions League', country: 'World' },
  bookmakers: [
    {
      id: 8,
      name: 'Bookmaker',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          values: [
            { value: 'Home', odd: '2.05' },
            { value: 'Draw', odd: '3.30' },
            { value: 'Away', odd: '3.40' },
          ],
        },
      ],
    },
  ],
};

const liveFixture = {
  fixture: {
    id: 9002,
    timezone: 'UTC',
    date: '2026-02-16T18:00:00.000Z',
    timestamp: 1771264800,
    status: { long: 'First Half', short: '1H', elapsed: 12 },
  },
  league: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    logo: 'https://example.com/league-39.png',
    flag: 'https://example.com/flag-eng.png',
  },
  teams: {
    home: { id: 300, name: 'Live United', logo: 'https://example.com/live-home.png' },
    away: { id: 400, name: 'City Live', logo: 'https://example.com/live-away.png' },
  },
  goals: { home: 1, away: 0 },
};

const liveOdds = {
  fixture: { id: 9002, date: '2026-02-16T18:00:00.000Z' },
  league: { id: 39, name: 'Premier League', country: 'England' },
  bookmakers: [
    {
      id: 8,
      name: 'Bookmaker',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          values: [
            { value: 'Home', odd: '2.00' },
            { value: 'Draw', odd: '2.90' },
            { value: 'Away', odd: '3.60' },
          ],
        },
        {
          id: 5,
          name: 'Over/Under',
          values: [
            { value: 'Over 2.5', odd: '1.70' },
            { value: 'Under 2.5', odd: '2.05' },
          ],
        },
      ],
    },
  ],
};

let leagueOddsRequests: string[] = [];

describe('Home Betting UX', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    let delayedLeagueOdds = false;
    leagueOddsRequests = [];

    cy.intercept('GET', '**/api/football/**', (req) => {
      const url = new URL(req.url);
      const path = url.pathname;
      const fixtureId = url.searchParams.get('fixture');
      const leagueId = url.searchParams.get('league');
      const ids = url.searchParams.get('ids') ?? '';
      const id = url.searchParams.get('id');
      const live = url.searchParams.get('live');

      if (path.endsWith('/odds/live')) {
        req.alias = 'liveOdds';
        req.reply({ statusCode: 200, body: wrapApiFootball([liveOdds]) });
        return;
      }

      if (path.endsWith('/fixtures') && live) {
        req.alias = 'liveFixtures';
        req.reply({ statusCode: 200, body: wrapApiFootball([liveFixture]) });
        return;
      }

      if (path.endsWith('/odds')) {
        if (fixtureId === '9001') {
          req.reply({ statusCode: 200, body: wrapApiFootball([preMatchOdds]) });
          return;
        }
        if (fixtureId === '9101') {
          req.reply({ statusCode: 200, body: wrapApiFootball([championsOdds]) });
          return;
        }
        if (leagueId) {
          leagueOddsRequests.push(leagueId);
          if (leagueId === '39') {
            req.alias = 'oddsLeague39';
          }
          if (leagueId === '2') {
            req.alias = 'oddsLeague2';
            req.reply({
              statusCode: 200,
              body: wrapApiFootball([championsOdds]),
            });
            return;
          }
          const delay = delayedLeagueOdds ? 0 : 900;
          delayedLeagueOdds = true;
          req.reply({
            delay,
            statusCode: 200,
            body: wrapApiFootball([preMatchOdds]),
          });
          return;
        }
        req.reply({ statusCode: 200, body: wrapApiFootball([]) });
        return;
      }

      if (path.endsWith('/fixtures') && ids.length > 0) {
        if (ids.includes('9001')) {
          req.alias = 'fixtures9001';
        }
        if (ids.includes('9101')) {
          req.alias = 'fixtures9101';
        }
        const body = ids.includes('9001')
          ? wrapApiFootball([preMatchFixture])
          : ids.includes('9101')
            ? wrapApiFootball([championsFixture])
            : wrapApiFootball([]);
        req.reply({ statusCode: 200, body });
        return;
      }

      if (path.endsWith('/fixtures') && id) {
        const body =
          id === '9001'
            ? wrapApiFootball([preMatchFixture])
            : id === '9101'
              ? wrapApiFootball([championsFixture])
              : wrapApiFootball([]);
        req.reply({ statusCode: 200, body });
        return;
      }

      req.reply({ statusCode: 200, body: wrapApiFootball([]) });
    });
  });

  it('shows skeleton then supports market switching', () => {
    cy.visit('/play?league=39');

    cy.get('[data-testid="view-tab-live"]').should('not.exist');
    cy.get('[data-testid="league-pill-39"]', { timeout: 30000 }).should('exist');
    cy.get('[data-testid="date-filter-trigger"]').should('exist');
    cy.get('[data-testid="date-filter-trigger"]').click({ force: true });
    cy.contains('In 3 Hours').should('exist');
    cy.contains('Future').should('exist');
    cy.contains('All Dates').click({ force: true });
    cy.get('[data-testid="extra-market-trigger"]').should('exist');
    cy.get('aside').first().within(() => {
      cy.contains('Search leagues...').should('not.exist');
    });
    cy.get('[data-testid="fixtures-skeleton"]').should('exist');
    cy.wait('@oddsLeague39', { timeout: 60000 });
    cy.contains('Alpha FC', { timeout: 30000 }).should('be.visible');
    cy.url().should('include', 'league=39');

    cy.contains('1.80', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="market-tab-over_under"]').click();
    cy.url().should('include', 'market=over_under');
    cy.contains('O2.5', { timeout: 30000 }).should('be.visible');
    cy.contains('1.92', { timeout: 30000 }).should('be.visible');

    cy.get('[data-testid="market-tab-double_chance"]').click();
    cy.contains('1/X', { timeout: 30000 }).should('be.visible');
    cy.contains('1.22', { timeout: 30000 }).should('be.visible');

    cy.get('[data-testid="extra-market-trigger"]').click();
    cy.get('[data-testid="extra-market-option-8"]').click();
    cy.url().should('include', 'market=extra_8');
    cy.contains('Both Teams To Score', { timeout: 30000 }).should('be.visible');
    cy.contains('1.67', { timeout: 30000 }).should('be.visible');
    cy.contains('2.10', { timeout: 30000 }).should('be.visible');
  });

  it('supports desktop drag scrolling on league header pills', () => {
    cy.visit('/play?league=39');
    cy.wait('@oddsLeague39', { timeout: 60000 });

    cy.get('[data-testid="league-tabs-scroll"]')
      .as('leagueTabs')
      .should(($tabs) => {
        expect($tabs[0].scrollWidth).to.be.greaterThan($tabs[0].clientWidth);
        expect($tabs[0].scrollLeft).to.equal(0);
      });

    cy.get('@leagueTabs').trigger('mousedown', { button: 0, clientX: 700, clientY: 10 });
    cy.get('@leagueTabs').trigger('mousemove', { clientX: 280, clientY: 10 });
    cy.get('@leagueTabs').trigger('mouseup', { force: true });

    cy.get('@leagueTabs').should(($tabs) => {
      expect($tabs[0].scrollLeft).to.be.greaterThan(0);
    });
  });

  it('keeps selected market/league through navigation and back', () => {
    cy.visit('/play?league=39&market=over_under');
    cy.wait('@oddsLeague39', { timeout: 60000 });
    cy.contains('Alpha FC', { timeout: 20000 }).should('be.visible');
    cy.contains('Alpha FC', { timeout: 20000 }).click();
    cy.url().should('include', '/play/fixture/9001');

    cy.get('[data-testid="fixture-markets-grid"]')
      .should('exist')
      .and('have.class', 'md:grid-cols-2');
    cy.get('[data-testid="market-accordion-content"]')
      .first()
      .should('not.be.visible');
    cy.get('[data-testid="market-accordion-toggle"]').first().click();
    cy.get('[data-testid="market-accordion-content"]')
      .first()
      .should('be.visible');

    cy.get('[data-testid="fixture-back-button"]').click();
    cy.url().should('include', '/play');
    cy.url().should('include', 'league=39');
    cy.url().should('include', 'market=over_under');
    cy.contains('O2.5', { timeout: 30000 }).should('be.visible');
    cy.contains('1.92', { timeout: 30000 }).should('be.visible');
  });

  it('keeps league=2 from URL and does not fallback to all leagues', () => {
    cy.visit('/play?league=2&market=extra_34');

    cy.wait('@oddsLeague2', { timeout: 60000 });
    cy.contains('Gamma FC', { timeout: 30000 }).should('be.visible');
    cy.location('search').should('include', 'league=2');
    cy.get('[data-testid="league-pill-2"]').should('exist');
    cy.then(() => {
      expect(new Set(leagueOddsRequests)).to.deep.equal(new Set(['2']));
    });
  });

  it('routes from fixture page to home and cleans unrelated params when sidebar league is clicked', () => {
    cy.visit('/play/fixture/9001?league=39&market=over_under&ticket=ABC123&book=11-030686');

    cy.get('aside').first().within(() => {
      cy.contains('button', 'La Liga').click();
    });

    cy.location('pathname').should('eq', '/play');
    cy.location('search').should('include', 'league=140');
    cy.location('search').should('include', 'market=over_under');
    cy.location('search').should('not.include', 'ticket=');
    cy.location('search').should('not.include', 'book=');
  });
});
