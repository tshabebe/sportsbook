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

describe('Home Betting UX', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    let delayedLeagueOdds = false;

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
        if (leagueId) {
          if (leagueId === '39') {
            req.alias = 'oddsLeague39';
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
        const body = ids.includes('9001')
          ? wrapApiFootball([preMatchFixture])
          : wrapApiFootball([]);
        req.reply({ statusCode: 200, body });
        return;
      }

      if (path.endsWith('/fixtures') && id) {
        const body = id === '9001' ? wrapApiFootball([preMatchFixture]) : wrapApiFootball([]);
        req.reply({ statusCode: 200, body });
        return;
      }

      req.reply({ statusCode: 200, body: wrapApiFootball([]) });
    });
  });

  it('shows skeleton then supports market switching', () => {
    cy.visit('/play?league=39');

    cy.get('[data-testid="view-tab-live"]').should('not.exist');
    cy.get('[data-testid="date-filter-trigger"]').should('be.visible');
    cy.get('[data-testid="extra-market-trigger"]').should('be.visible');
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

  it('keeps selected market/league through navigation and back', () => {
    cy.visit('/play?league=39&market=over_under');
    cy.contains('Alpha FC', { timeout: 20000 }).should('be.visible');
    cy.contains('Alpha FC', { timeout: 20000 }).click();
    cy.url().should('include', '/play/fixture/9001');

    cy.get('[data-testid="fixture-back-button"]').click();
    cy.url().should('include', '/play');
    cy.url().should('include', 'league=39');
    cy.url().should('include', 'market=over_under');
    cy.contains('O2.5', { timeout: 30000 }).should('be.visible');
    cy.contains('1.92', { timeout: 30000 }).should('be.visible');
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
