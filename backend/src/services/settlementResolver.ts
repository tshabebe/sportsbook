const FINAL_STATUSES = new Set([
  'FT',
  'AET',
  'PEN',
  'CANC',
  'ABD',
  'AWD',
  'WO',
]);

type TeamInfo = {
  id?: number;
  name?: string;
};

type FixtureStatisticsRow = {
  team?: TeamInfo;
  statistics?: Array<{ type?: string; value?: string | number | null }>;
};

type FixtureEvent = {
  type?: string;
  detail?: string;
  time?: { elapsed?: number; extra?: number | null };
  team?: TeamInfo;
  player?: { id?: number; name?: string };
};

export type FixtureSettlementContext = {
  fixtureId: number;
  statusShort?: string;
  teams?: {
    home?: TeamInfo;
    away?: TeamInfo;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
  events?: FixtureEvent[];
  statistics?: FixtureStatisticsRow[];
};

export type SelectionSettlementInput = {
  fixtureId?: number;
  marketBetId?: string | number | null;
  marketName?: string | null;
  value: string;
  handicap?: string | number | null;
  odd?: string | number;
};

export type SelectionSettlementResult = {
  outcome: 'won' | 'lost' | 'void' | 'unresolved';
  reason: string;
};

const normalizeText = (value: string | null | undefined): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const parseMaybeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const extractNumberFromText = (value: string): number | null => {
  const match = value.match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return parseMaybeNumber(match[0]);
};

const extractScorePair = (value: string): { home: number; away: number } | null => {
  const match = value.match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
};

const isFinalStatus = (statusShort?: string): boolean =>
  Boolean(statusShort && FINAL_STATUSES.has(statusShort));

const getFulltimeGoals = (
  fixture: FixtureSettlementContext,
): { home: number; away: number } | null => {
  const fullHome =
    parseMaybeNumber(fixture.score?.fulltime?.home) ?? parseMaybeNumber(fixture.goals?.home);
  const fullAway =
    parseMaybeNumber(fixture.score?.fulltime?.away) ?? parseMaybeNumber(fixture.goals?.away);

  if (fullHome === null || fullAway === null) return null;
  return { home: fullHome, away: fullAway };
};

const getHalftimeGoals = (
  fixture: FixtureSettlementContext,
): { home: number; away: number } | null => {
  const home = parseMaybeNumber(fixture.score?.halftime?.home);
  const away = parseMaybeNumber(fixture.score?.halftime?.away);
  if (home === null || away === null) return null;
  return { home, away };
};

const getSecondHalfGoals = (
  fixture: FixtureSettlementContext,
): { home: number; away: number } | null => {
  const ht = getHalftimeGoals(fixture);
  const ft = getFulltimeGoals(fixture);
  if (!ht || !ft) return null;
  return { home: ft.home - ht.home, away: ft.away - ht.away };
};

const getTeamIds = (fixture: FixtureSettlementContext) => ({
  homeId: parseMaybeNumber(fixture.teams?.home?.id),
  awayId: parseMaybeNumber(fixture.teams?.away?.id),
});

const parseStatNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const digits = value.match(/\d+/);
  return digits ? Number(digits[0]) : null;
};

const getTeamStatValue = (
  statistics: FixtureStatisticsRow[] | undefined,
  teamId: number | null,
  statLabels: string[],
): number | null => {
  if (!statistics || statistics.length === 0 || teamId === null) return null;
  const row = statistics.find((entry) => parseMaybeNumber(entry.team?.id) === teamId);
  if (!row?.statistics) return null;

  for (const label of statLabels) {
    const stat = row.statistics.find(
      (item) => normalizeText(item.type) === normalizeText(label),
    );
    const parsed = parseStatNumber(stat?.value);
    if (parsed !== null) return parsed;
  }

  return null;
};

const countCardEvents = (
  events: FixtureEvent[] | undefined,
  teamId: number | null,
  cardType: 'yellow' | 'red' | 'any',
): number | null => {
  if (!events || events.length === 0) return null;
  const filtered = events.filter((event) => {
    const type = normalizeText(event.type);
    const detail = normalizeText(event.detail);
    if (type !== 'card' && !detail.includes('card')) return false;

    const eventTeamId = parseMaybeNumber(event.team?.id);
    if (teamId !== null && eventTeamId !== teamId) return false;

    if (cardType === 'yellow') return detail.includes('yellow');
    if (cardType === 'red') return detail.includes('red');
    return true;
  });
  return filtered.length;
};

const countGoalEventsByTeam = (
  events: FixtureEvent[] | undefined,
  teamId: number | null,
): number | null => {
  if (!events || events.length === 0 || teamId === null) return null;
  const goals = events.filter((event) => {
    const type = normalizeText(event.type);
    const detail = normalizeText(event.detail);
    const eventTeamId = parseMaybeNumber(event.team?.id);
    if (eventTeamId !== teamId) return false;
    return type === 'goal' || detail.includes('goal');
  });
  return goals.length;
};

const eventTimeSortValue = (event: FixtureEvent, index: number): number => {
  const elapsed = parseMaybeNumber(event.time?.elapsed) ?? 0;
  const extra = parseMaybeNumber(event.time?.extra) ?? 0;
  return elapsed * 100 + extra + index * 0.0001;
};

const isGoalEvent = (event: FixtureEvent): boolean => {
  const type = normalizeText(event.type);
  const detail = normalizeText(event.detail);
  return type === 'goal' || detail.includes('goal');
};

const getOrderedGoalEvents = (events: FixtureEvent[] | undefined): FixtureEvent[] => {
  if (!events || events.length === 0) return [];
  return events
    .filter((event) => isGoalEvent(event))
    .map((event, index) => ({ event, sort: eventTimeSortValue(event, index) }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.event);
};

const scoreWinner = (
  home: number,
  away: number,
): 'home' | 'away' | 'draw' => {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
};

const isFirstHalfMarket = (marketName: string): boolean =>
  marketName.includes('1st half') ||
  marketName.includes('first half') ||
  marketName.includes('half time');

const isSecondHalfMarket = (marketName: string): boolean =>
  marketName.includes('2nd half') ||
  marketName.includes('second half');

const parseWinnerPartToken = (value: string): 'home' | 'away' | 'draw' | null => {
  const token = normalizeText(value);
  if (['home', '1'].includes(token)) return 'home';
  if (['away', '2'].includes(token)) return 'away';
  if (['draw', 'x'].includes(token)) return 'draw';
  return null;
};

const parseYesNoToken = (value: string): 'yes' | 'no' | null => {
  const token = normalizeText(value);
  if (token === 'yes' || token === 'y') return 'yes';
  if (token === 'no' || token === 'n') return 'no';
  return null;
};

const parseGoalsRange = (
  value: string,
): { min: number; max: number } | null => {
  const token = normalizeText(value);

  const plusMatch = token.match(/(\d+)\s*\+/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    return { min, max: Number.POSITIVE_INFINITY };
  }

  const orMoreMatch = token.match(/(\d+)\s*(or more|and over|& over)/);
  if (orMoreMatch) {
    const min = Number(orMoreMatch[1]);
    return { min, max: Number.POSITIVE_INFINITY };
  }

  const morePrefixMatch = token.match(/(?:more|over)\s*(\d+)/);
  if (morePrefixMatch) {
    const min = Number(morePrefixMatch[1]);
    return { min, max: Number.POSITIVE_INFINITY };
  }

  const exactlyMatch = token.match(/exact(?:ly)?\s*(\d+)/);
  if (exactlyMatch) {
    const exact = Number(exactlyMatch[1]);
    return { min: exact, max: exact };
  }

  const rangeMatch = token.match(/(\d+)\s*[-:]\s*(\d+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min <= max) return { min, max };
  }

  const exactMatch = token.match(/^(\d+)$/);
  if (exactMatch) {
    const exact = Number(exactMatch[1]);
    return { min: exact, max: exact };
  }

  return null;
};

const evaluateWinnerToken = (
  token: string,
  home: number,
  away: number,
): SelectionSettlementResult | null => {
  if (['home', '1'].includes(token)) {
    return {
      outcome: home > away ? 'won' : 'lost',
      reason: 'match winner home',
    };
  }
  if (['away', '2'].includes(token)) {
    return {
      outcome: away > home ? 'won' : 'lost',
      reason: 'match winner away',
    };
  }
  if (['draw', 'x'].includes(token)) {
    return {
      outcome: home === away ? 'won' : 'lost',
      reason: 'match winner draw',
    };
  }
  return null;
};

const evaluateDoubleChanceToken = (
  token: string,
  home: number,
  away: number,
): SelectionSettlementResult | null => {
  if (['home/draw', '1/x', '1x', 'home or draw'].includes(token)) {
    return {
      outcome: home >= away ? 'won' : 'lost',
      reason: 'double chance 1x',
    };
  }
  if (['home/away', '1/2', '12', 'home or away'].includes(token)) {
    return {
      outcome: home !== away ? 'won' : 'lost',
      reason: 'double chance 12',
    };
  }
  if (['draw/away', 'x/2', 'x2', 'draw or away'].includes(token)) {
    return {
      outcome: away >= home ? 'won' : 'lost',
      reason: 'double chance x2',
    };
  }
  return null;
};

const evaluateOverUnder = (
  sideToken: string,
  line: number,
  total: number,
  reason: string,
  options?: { pushOnEqual?: boolean },
): SelectionSettlementResult => {
  if (sideToken === 'over') {
    if (options?.pushOnEqual && total === line) return { outcome: 'void', reason: `${reason} push` };
    return { outcome: total > line ? 'won' : 'lost', reason };
  }
  if (sideToken === 'under') {
    if (options?.pushOnEqual && total === line) return { outcome: 'void', reason: `${reason} push` };
    return { outcome: total < line ? 'won' : 'lost', reason };
  }
  return { outcome: 'unresolved', reason: `${reason} unsupported over/under side` };
};

const evaluateOddEven = (token: string, value: number, reason: string): SelectionSettlementResult | null => {
  if (token === 'odd') return { outcome: value % 2 === 1 ? 'won' : 'lost', reason };
  if (token === 'even') return { outcome: value % 2 === 0 ? 'won' : 'lost', reason };
  return null;
};

const getThreshold = (selection: SelectionSettlementInput): number | null => {
  const fromHandicap = parseMaybeNumber(selection.handicap);
  if (fromHandicap !== null) return fromHandicap;
  return extractNumberFromText(selection.value);
};

const parseSideFromSelection = (value: string): 'home' | 'away' | 'draw' | null => {
  const token = normalizeText(value);
  if (['home', '1', 'team 1', '1st', 'h'].includes(token)) return 'home';
  if (['away', '2', 'team 2', '2nd', 'a'].includes(token)) return 'away';
  if (['draw', 'x', 'tie'].includes(token)) return 'draw';
  return null;
};

const parseNoGoalToken = (value: string): boolean => {
  const token = normalizeText(value);
  return token.includes('no goal') || token.includes('none') || token.includes('no scorer');
};

const extractMinuteWindowFromText = (
  value: string,
): { start: number; end: number } | null => {
  const token = normalizeText(value);
  const directRange = token.match(/(\d+)\s*-\s*(\d+)/);
  if (directRange) {
    const start = Number(directRange[1]);
    const end = Number(directRange[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
      return { start, end };
    }
  }

  const compactRange = token.match(/(\d+)\s*m\s*-\s*(\d+)\s*m/);
  if (compactRange) {
    const start = Number(compactRange[1]);
    const end = Number(compactRange[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
      return { start, end };
    }
  }

  const betweenRange = token.match(/between\s*(\d+)\s*and\s*(\d+)\s*m?/);
  if (betweenRange) {
    const start = Number(betweenRange[1]);
    const end = Number(betweenRange[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
      return { start, end };
    }
  }

  return null;
};

const parseMinuteThresholdFromMarket = (marketName: string): number | null => {
  const token = normalizeText(marketName);
  const minuteMatch = token.match(/-\s*(\d+)\s*minutes?/);
  if (minuteMatch) return Number(minuteMatch[1]);
  return null;
};

const getGoalsByScope = (
  marketName: string,
  ft: { home: number; away: number },
  ht: { home: number; away: number } | null,
  sh: { home: number; away: number } | null,
): { home: number; away: number } | null => {
  if (isSecondHalfMarket(marketName)) return sh;
  if (isFirstHalfMarket(marketName)) return ht;
  return ft;
};

const getGoalEventsForWindow = (
  events: FixtureEvent[] | undefined,
  startMinute: number,
  endMinute: number,
): FixtureEvent[] => {
  if (!events || events.length === 0) return [];
  return getOrderedGoalEvents(events).filter((event) => {
    const elapsed = parseMaybeNumber(event.time?.elapsed);
    if (elapsed === null) return false;
    return elapsed >= startMinute && elapsed <= endMinute;
  });
};

const getScoreAtMinute = (
  fixture: FixtureSettlementContext,
  minute: number,
): { home: number; away: number } | null => {
  const { homeId, awayId } = getTeamIds(fixture);
  if (homeId === null || awayId === null) return null;
  const goals = getGoalEventsForWindow(fixture.events, 0, minute);
  if (!fixture.events || fixture.events.length === 0) return null;

  let home = 0;
  let away = 0;
  for (const event of goals) {
    const teamId = parseMaybeNumber(event.team?.id);
    if (teamId === homeId) home += 1;
    if (teamId === awayId) away += 1;
  }
  return { home, away };
};

const parseMarketSide = (marketName: string): 'home' | 'away' | null => {
  if (marketName.includes('home')) return 'home';
  if (marketName.includes('away')) return 'away';
  return null;
};

const didTeamWinBothHalves = (
  side: 'home' | 'away',
  ht: { home: number; away: number } | null,
  sh: { home: number; away: number } | null,
): boolean | null => {
  if (!ht || !sh) return null;
  if (side === 'home') return ht.home > ht.away && sh.home > sh.away;
  return ht.away > ht.home && sh.away > sh.home;
};

const didTeamScoreInBothHalves = (
  side: 'home' | 'away',
  ht: { home: number; away: number } | null,
  sh: { home: number; away: number } | null,
): boolean | null => {
  if (!ht || !sh) return null;
  if (side === 'home') return ht.home > 0 && sh.home > 0;
  return ht.away > 0 && sh.away > 0;
};

const wasTeamTrailingAtHalf = (
  side: 'home' | 'away',
  ht: { home: number; away: number } | null,
): boolean | null => {
  if (!ht) return null;
  if (side === 'home') return ht.home < ht.away;
  return ht.away < ht.home;
};

const didTeamWinFullTime = (
  side: 'home' | 'away',
  ft: { home: number; away: number },
): boolean => (side === 'home' ? ft.home > ft.away : ft.away > ft.home);

const didTeamDrawFullTime = (
  side: 'home' | 'away',
  ft: { home: number; away: number },
): boolean => {
  if (side === 'home' || side === 'away') return ft.home === ft.away;
  return false;
};

const didTeamScoreByScope = (
  side: 'home' | 'away',
  marketName: string,
  ft: { home: number; away: number },
  ht: { home: number; away: number } | null,
  sh: { home: number; away: number } | null,
): boolean | null => {
  const scoped = getGoalsByScope(marketName, ft, ht, sh);
  if (!scoped) return null;
  return side === 'home' ? scoped.home > 0 : scoped.away > 0;
};

const parseStatPair = (
  fixture: FixtureSettlementContext,
  labels: string[],
): { home: number; away: number } | null => {
  const { homeId, awayId } = getTeamIds(fixture);
  const home = getTeamStatValue(fixture.statistics, homeId, labels);
  const away = getTeamStatValue(fixture.statistics, awayId, labels);
  if (home === null || away === null) return null;
  return { home, away };
};

const parseCardStats = (
  fixture: FixtureSettlementContext,
  cardType: 'yellow' | 'red' | 'any',
): { home: number; away: number } | null => {
  const { homeId, awayId } = getTeamIds(fixture);
  const fromEventsHome = countCardEvents(fixture.events, homeId, cardType);
  const fromEventsAway = countCardEvents(fixture.events, awayId, cardType);
  if (fromEventsHome !== null && fromEventsAway !== null) {
    return { home: fromEventsHome, away: fromEventsAway };
  }

  const labels =
    cardType === 'yellow'
      ? ['Yellow Cards']
      : cardType === 'red'
        ? ['Red Cards']
        : ['Yellow Cards', 'Red Cards'];

  if (cardType === 'any') {
    const yellow = parseStatPair(fixture, ['Yellow Cards']);
    const red = parseStatPair(fixture, ['Red Cards']);
    if (!yellow || !red) return null;
    return { home: yellow.home + red.home, away: yellow.away + red.away };
  }

  return parseStatPair(fixture, labels);
};

const getMetricPairForMarket = (
  fixture: FixtureSettlementContext,
  marketName: string,
): { home: number; away: number } | null => {
  if (marketName.includes('corner')) {
    return parseStatPair(fixture, ['Corner Kicks']);
  }
  if (marketName.includes('offside')) {
    return parseStatPair(fixture, ['Offsides']);
  }
  if (marketName.includes('foul')) {
    return parseStatPair(fixture, ['Fouls']);
  }
  if (marketName.includes('shotontarget') || marketName.includes('shots on target')) {
    return parseStatPair(fixture, [
      'Shots on Goal',
      'Shots on Target',
      'Shots On Goal',
      'Shots On Target',
    ]);
  }
  if (marketName.includes('shot') && !marketName.includes('goal')) {
    return parseStatPair(fixture, ['Total Shots']);
  }
  if (marketName.includes('save')) {
    return parseStatPair(fixture, ['Goalkeeper Saves', 'Saves']);
  }
  return null;
};

const evaluateHandicap = (
  selection: SelectionSettlementInput,
  fixture: FixtureSettlementContext,
  marketName: string,
): SelectionSettlementResult | null => {
  const ft = getFulltimeGoals(fixture);
  if (!ft) return { outcome: 'unresolved', reason: 'missing final score for handicap' };

  const side = parseSideFromSelection(selection.value);
  if (!side || side === 'draw') return null;

  const line = getThreshold(selection);
  if (line === null) {
    return { outcome: 'unresolved', reason: 'missing handicap line' };
  }

  const adjustedDiff = side === 'home'
    ? ft.home - ft.away + line
    : ft.away - ft.home + line;

  if (marketName.includes('asian')) {
    if (adjustedDiff > 0) return { outcome: 'won', reason: 'asian handicap won' };
    if (adjustedDiff < 0) return { outcome: 'lost', reason: 'asian handicap lost' };
    return { outcome: 'void', reason: 'asian handicap push' };
  }

  if (adjustedDiff > 0) return { outcome: 'won', reason: 'handicap won' };
  if (adjustedDiff < 0) return { outcome: 'lost', reason: 'handicap lost' };
  return { outcome: 'void', reason: 'handicap push' };
};

const resolveByMarketName = (
  selection: SelectionSettlementInput,
  fixture: FixtureSettlementContext,
  marketNameRaw: string,
): SelectionSettlementResult => {
  const marketName = normalizeText(marketNameRaw);
  const valueToken = normalizeText(selection.value);
  const ft = getFulltimeGoals(fixture);
  const ht = getHalftimeGoals(fixture);
  const sh = getSecondHalfGoals(fixture);

  if (!ft) {
    return { outcome: 'unresolved', reason: 'missing final score' };
  }

  const { homeId, awayId } = getTeamIds(fixture);
  const isFirstHalf = isFirstHalfMarket(marketName);
  const isSecondHalf = isSecondHalfMarket(marketName);

  if (marketName === 'home/away') {
    const side = parseSideFromSelection(selection.value);
    if (!side || side === 'draw') return { outcome: 'unresolved', reason: 'home/away side parse failed' };
    if (ft.home === ft.away) return { outcome: 'lost', reason: 'home/away draw is losing outcome' };
    return {
      outcome: side === 'home' ? (ft.home > ft.away ? 'won' : 'lost') : ft.away > ft.home ? 'won' : 'lost',
      reason: 'home/away market',
    };
  }

  const minuteThreshold = parseMinuteThresholdFromMarket(marketName);
  if (minuteThreshold !== null && (marketName.includes('1x2') || marketName.startsWith('dc'))) {
    const scoreAtMinute = getScoreAtMinute(fixture, minuteThreshold);
    if (!scoreAtMinute) {
      return {
        outcome: 'unresolved',
        reason: `missing goal timeline for minute-window market (${minuteThreshold})`,
      };
    }

    if (marketName.includes('1x2')) {
      const minuteWinner = evaluateWinnerToken(
        valueToken,
        scoreAtMinute.home,
        scoreAtMinute.away,
      );
      if (minuteWinner) return minuteWinner;
    }

    if (marketName.startsWith('dc')) {
      const minuteDc = evaluateDoubleChanceToken(
        valueToken,
        scoreAtMinute.home,
        scoreAtMinute.away,
      );
      if (minuteDc) return minuteDc;
    }
  }

  const minuteWindow = extractMinuteWindowFromText(marketName);
  if (minuteWindow && marketName.includes('goal in')) {
    const goals = getGoalEventsForWindow(fixture.events, minuteWindow.start, minuteWindow.end);
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo) {
      const hasGoal = goals.length > 0;
      return {
        outcome: yesNo === 'yes' ? (hasGoal ? 'won' : 'lost') : hasGoal ? 'lost' : 'won',
        reason: 'goal in minute window',
      };
    }

    const side = parseSideFromSelection(selection.value);
    if (side === 'home' || side === 'away') {
      const targetTeamId = side === 'home' ? homeId : awayId;
      const scored = goals.some((event) => parseMaybeNumber(event.team?.id) === targetTeamId);
      return { outcome: scored ? 'won' : 'lost', reason: 'team goal in minute window' };
    }

    if (parseNoGoalToken(selection.value)) {
      return { outcome: goals.length === 0 ? 'won' : 'lost', reason: 'no goal in minute window' };
    }
  }

  if (minuteWindow && marketName.includes('over/under')) {
    const goals = getGoalEventsForWindow(fixture.events, minuteWindow.start, minuteWindow.end);
    const threshold = getThreshold(selection);
    if (threshold !== null && (valueToken.includes('over') || valueToken.includes('under'))) {
      return evaluateOverUnder(
        valueToken.includes('over') ? 'over' : 'under',
        threshold,
        goals.length,
        'minute-window totals market',
      );
    }
  }

  if (marketName.includes('half time/full time') || marketName.includes('ht/ft')) {
    if (!ht) return { outcome: 'unresolved', reason: 'missing halftime score for ht/ft' };

    const separators = selection.value.includes('/')
      ? '/'
      : selection.value.includes('-')
        ? '-'
        : null;
    if (!separators) {
      return { outcome: 'unresolved', reason: 'ht/ft selection parse failed' };
    }

    const [htTokenRaw, ftTokenRaw] = selection.value.split(separators);
    const expectedHt = parseWinnerPartToken(htTokenRaw);
    const expectedFt = parseWinnerPartToken(ftTokenRaw);
    if (!expectedHt || !expectedFt) {
      return { outcome: 'unresolved', reason: 'ht/ft selection token unsupported' };
    }

    const actualHt = scoreWinner(ht.home, ht.away);
    const actualFt = scoreWinner(ft.home, ft.away);
    const won = actualHt === expectedHt && actualFt === expectedFt;
    return { outcome: won ? 'won' : 'lost', reason: 'half time/full time' };
  }

  if (marketName.includes('win to nil')) {
    const side = parseSideFromSelection(selection.value);
    const sideFromMarket = parseMarketSide(marketName);
    const effectiveSide = sideFromMarket ?? side;
    if (!effectiveSide) {
      return { outcome: 'unresolved', reason: 'win to nil side unresolved' };
    }

    if (marketName.includes('1st half') || marketName.includes('2nd half')) {
      const scoped = getGoalsByScope(marketName, ft, ht, sh);
      if (!scoped) return { outcome: 'unresolved', reason: 'missing scoped score for win to nil' };
      if (effectiveSide === 'home') {
        return {
          outcome: scoped.home > 0 && scoped.away === 0 ? 'won' : 'lost',
          reason: 'win to nil scoped',
        };
      }
      return {
        outcome: scoped.away > 0 && scoped.home === 0 ? 'won' : 'lost',
        reason: 'win to nil scoped',
      };
    }

    if (effectiveSide === 'home') {
      return { outcome: ft.home > 0 && ft.away === 0 ? 'won' : 'lost', reason: 'win to nil home' };
    }
    if (effectiveSide === 'away') {
      return { outcome: ft.away > 0 && ft.home === 0 ? 'won' : 'lost', reason: 'win to nil away' };
    }
  }

  if (marketName.includes('clean sheet')) {
    const yesNo = parseYesNoToken(selection.value);
    const sideFromMarket = marketName.includes('away') ? 'away' : marketName.includes('home') ? 'home' : null;
    const side = sideFromMarket ?? parseSideFromSelection(selection.value);
    if (!side || side === 'draw') {
      return { outcome: 'unresolved', reason: 'clean sheet side unsupported' };
    }

    const hasCleanSheet = side === 'home' ? ft.away === 0 : ft.home === 0;
    if (yesNo === 'yes') return { outcome: hasCleanSheet ? 'won' : 'lost', reason: 'clean sheet yes/no' };
    if (yesNo === 'no') return { outcome: hasCleanSheet ? 'lost' : 'won', reason: 'clean sheet yes/no' };
    return { outcome: hasCleanSheet ? 'won' : 'lost', reason: 'clean sheet side' };
  }

  const winnerScore = isSecondHalf ? sh : isFirstHalf ? ht : ft;
  const fullWinner = winnerScore ? evaluateWinnerToken(valueToken, winnerScore.home, winnerScore.away) : null;
  if (
    marketName.includes('winner') ||
    marketName.includes('result') ||
    marketName === ''
  ) {
    if (!winnerScore) return { outcome: 'unresolved', reason: 'missing scoped score for winner market' };
    if (fullWinner) return fullWinner;
  }

  const doubleChance = evaluateDoubleChanceToken(valueToken, ft.home, ft.away);
  if (doubleChance && marketName.includes('double chance')) {
    return doubleChance;
  }

  if (marketName.includes('no bet')) {
    if (ft.home === ft.away) return { outcome: 'void', reason: 'no bet push on draw' };
    const fixedSide = parseMarketSide(marketName);
    const side = fixedSide ?? parseSideFromSelection(selection.value);
    if (!side || side === 'draw') return { outcome: 'unresolved', reason: 'no bet side unsupported' };
    return {
      outcome: side === 'home' ? (ft.home > ft.away ? 'won' : 'lost') : ft.away > ft.home ? 'won' : 'lost',
      reason: 'no bet',
    };
  }

  if (marketName.includes('draw no bet')) {
    if (ft.home === ft.away) return { outcome: 'void', reason: 'draw no bet push' };
    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: ft.home > ft.away ? 'won' : 'lost', reason: 'draw no bet home' };
    if (side === 'away') return { outcome: ft.away > ft.home ? 'won' : 'lost', reason: 'draw no bet away' };
  }

  if (
    marketName.includes('both teams to score') ||
    marketName.includes('both teams score') ||
    marketName.includes('btts')
  ) {
    const scopeScore = isSecondHalf ? sh : isFirstHalf ? ht : ft;
    if (!scopeScore) return { outcome: 'unresolved', reason: 'missing scoped score for btts' };
    const scoredByBoth = scopeScore.home > 0 && scopeScore.away > 0;
    if (valueToken === 'yes') return { outcome: scoredByBoth ? 'won' : 'lost', reason: 'btts yes/no' };
    if (valueToken === 'no') return { outcome: scoredByBoth ? 'lost' : 'won', reason: 'btts yes/no' };

    if (marketName.includes('match result') || marketName.includes('results/')) {
      const yesNo = valueToken.includes('yes') ? 'yes' : valueToken.includes('no') ? 'no' : null;
      const winnerToken = valueToken
        .replace(/yes|no|&|\s+and\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .find(Boolean);

      if (yesNo && winnerToken) {
        const bttsOk = yesNo === 'yes' ? scoredByBoth : !scoredByBoth;
        const winnerOk = Boolean(evaluateWinnerToken(winnerToken, ft.home, ft.away)?.outcome === 'won');
        return { outcome: bttsOk && winnerOk ? 'won' : 'lost', reason: 'btts + match result' };
      }
    }
  }

  if (marketName.includes('odd/even')) {
    const scopeScore = isSecondHalf ? sh : isFirstHalf ? ht : ft;
    if (!scopeScore) return { outcome: 'unresolved', reason: 'missing scoped score for odd/even' };
    const oddEven = evaluateOddEven(valueToken, scopeScore.home + scopeScore.away, 'odd/even goals');
    if (oddEven) return oddEven;
  }

  if (marketName.includes('exact score') || marketName.includes('correct score')) {
    const score = extractScorePair(selection.value);
    if (!score) return { outcome: 'unresolved', reason: 'exact score parse failed' };
    const scopeScore = getGoalsByScope(marketName, ft, ht, sh);
    if (!scopeScore) return { outcome: 'unresolved', reason: 'missing scoped score for exact score' };
    return {
      outcome: score.home === scopeScore.home && score.away === scopeScore.away ? 'won' : 'lost',
      reason: 'exact score',
    };
  }

  if (marketName.includes('first goal') || marketName.includes('last goal')) {
    const goalEvents = getOrderedGoalEvents(fixture.events);
    const noGoal = valueToken.includes('no goal') || valueToken.includes('no scorer') || valueToken === 'none';
    if (noGoal) {
      return { outcome: goalEvents.length === 0 ? 'won' : 'lost', reason: 'first/last goal no-goal' };
    }

    if (goalEvents.length === 0) {
      return { outcome: 'unresolved', reason: 'missing goal events for first/last goal market' };
    }

    const targetEvent = marketName.includes('last goal')
      ? goalEvents[goalEvents.length - 1]
      : goalEvents[0];

    if (marketName.includes('scorer') || marketName.includes('player')) {
      const playerName = normalizeText(selection.value);
      const scorer = normalizeText(targetEvent.player?.name);
      return { outcome: scorer === playerName ? 'won' : 'lost', reason: 'first/last scorer market' };
    }

    const side = parseSideFromSelection(selection.value);
    const eventTeamId = parseMaybeNumber(targetEvent.team?.id);
    if (side === 'home') return { outcome: eventTeamId === homeId ? 'won' : 'lost', reason: 'first/last goal team' };
    if (side === 'away') return { outcome: eventTeamId === awayId ? 'won' : 'lost', reason: 'first/last goal team' };
  }

  if (marketName.includes('player') || marketName.includes('scorer')) {
    const playerName = normalizeText(selection.value);
    const goalEvents = getOrderedGoalEvents(fixture.events);
    if (goalEvents.length === 0) {
      return { outcome: 'unresolved', reason: 'missing events for player market' };
    }
    const hasGoal = goalEvents.some((event) => {
      const name = normalizeText(event.player?.name);
      return name === playerName;
    });
    return { outcome: hasGoal ? 'won' : 'lost', reason: 'player scorer market' };
  }

  if (marketName.includes('handicap')) {
    const handicap = evaluateHandicap(selection, fixture, marketName);
    if (handicap) return handicap;
  }

  if (marketName.includes('goal line')) {
    const threshold = getThreshold(selection);
    const scopeScore = getGoalsByScope(marketName, ft, ht, sh);
    if (!scopeScore) return { outcome: 'unresolved', reason: 'missing scoped score for goal line' };
    if (threshold === null) return { outcome: 'unresolved', reason: 'missing goal line threshold' };
    const sideIsOverUnder = valueToken.includes('over')
      ? 'over'
      : valueToken.includes('under')
        ? 'under'
        : null;
    if (!sideIsOverUnder) return { outcome: 'unresolved', reason: 'unsupported goal line side' };
    return evaluateOverUnder(
      sideIsOverUnder,
      threshold,
      scopeScore.home + scopeScore.away,
      'goal line',
      { pushOnEqual: true },
    );
  }

  if (
    marketName.includes('exact goals number') ||
    marketName.includes('number of goals in match (range)') ||
    marketName.includes('team exact goals number')
  ) {
    const scopeScore = getGoalsByScope(marketName, ft, ht, sh);
    if (!scopeScore) return { outcome: 'unresolved', reason: 'missing scoped score for exact goals' };
    let targetTotal = scopeScore.home + scopeScore.away;
    if (marketName.includes('home')) targetTotal = scopeScore.home;
    if (marketName.includes('away')) targetTotal = scopeScore.away;

    const range = parseGoalsRange(selection.value);
    if (!range) return { outcome: 'unresolved', reason: 'exact goals range parse failed' };
    const inRange = targetTotal >= range.min && targetTotal <= range.max;
    return { outcome: inRange ? 'won' : 'lost', reason: 'exact/range goals number' };
  }

  const threshold = getThreshold(selection);
  const sideIsOverUnder = valueToken.includes('over')
    ? 'over'
    : valueToken.includes('under')
      ? 'under'
      : null;
  const isCornerMarket = marketName.includes('corner');
  const isCardOrBookingMarket = marketName.includes('card') || marketName.includes('booking');

  if (
    !isCornerMarket &&
    !isCardOrBookingMarket &&
    (marketName.includes('total') ||
      marketName.includes('over/under') ||
      marketName.includes('goals over/under'))
  ) {
    let targetTotal: number | null = ft.home + ft.away;

    if (marketName.includes('home team')) targetTotal = ft.home;
    if (marketName.includes('away team')) targetTotal = ft.away;

    if (marketName.includes('1st half') || marketName.includes('first half')) {
      if (!ht) return { outcome: 'unresolved', reason: 'missing halftime score' };
      targetTotal = ht.home + ht.away;
      if (marketName.includes('home')) targetTotal = ht.home;
      if (marketName.includes('away')) targetTotal = ht.away;
    }

    if (marketName.includes('2nd half') || marketName.includes('second half')) {
      if (!sh) return { outcome: 'unresolved', reason: 'missing second-half score' };
      targetTotal = sh.home + sh.away;
      if (marketName.includes('home')) targetTotal = sh.home;
      if (marketName.includes('away')) targetTotal = sh.away;
    }

    if (threshold !== null && sideIsOverUnder) {
      return evaluateOverUnder(sideIsOverUnder, threshold, targetTotal, 'totals market');
    }

    const range = parseGoalsRange(selection.value);
    if (range) {
      const inRange = targetTotal >= range.min && targetTotal <= range.max;
      return { outcome: inRange ? 'won' : 'lost', reason: 'exact/range totals market' };
    }

    return { outcome: 'unresolved', reason: 'missing threshold for totals market' };
  }

  if (
    marketName.includes('win/over') ||
    marketName.includes('win/under') ||
    marketName.includes('not lose/over') ||
    marketName.includes('not lose/under')
  ) {
    if (threshold === null) {
      return { outcome: 'unresolved', reason: 'missing threshold for combined win/totals market' };
    }

    const sideFromMarket = parseMarketSide(marketName);
    if (!sideFromMarket) return { outcome: 'unresolved', reason: 'missing market side for combined market' };
    const totalGoals = ft.home + ft.away;
    const totalOk = marketName.includes('/over') ? totalGoals > threshold : totalGoals < threshold;
    const resultOk = marketName.includes('not lose')
      ? sideFromMarket === 'home'
        ? ft.home >= ft.away
        : ft.away >= ft.home
      : sideFromMarket === 'home'
        ? ft.home > ft.away
        : ft.away > ft.home;
    return { outcome: totalOk && resultOk ? 'won' : 'lost', reason: 'combined win/totals market' };
  }

  if (isCornerMarket) {
    const pair = getMetricPairForMarket(fixture, marketName);
    if (!pair) {
      return { outcome: 'unresolved', reason: 'missing corner stats' };
    }

    const { home: homeCorners, away: awayCorners } = pair;
    const totalCorners = homeCorners + awayCorners;
    if (sideIsOverUnder) {
      if (threshold === null) return { outcome: 'unresolved', reason: 'missing threshold for corner market' };
      return evaluateOverUnder(sideIsOverUnder, threshold, totalCorners, 'corner totals market');
    }

    if (marketName.includes('odd/even')) {
      const oddEven = evaluateOddEven(valueToken, totalCorners, 'corner odd/even');
      if (oddEven) return oddEven;
    }

    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: homeCorners > awayCorners ? 'won' : 'lost', reason: 'corner winner home' };
    if (side === 'away') return { outcome: awayCorners > homeCorners ? 'won' : 'lost', reason: 'corner winner away' };
    if (side === 'draw') return { outcome: awayCorners === homeCorners ? 'won' : 'lost', reason: 'corner winner draw' };

    return { outcome: 'unresolved', reason: 'unsupported corner market selection' };
  }

  if (isCardOrBookingMarket) {
    if (threshold === null && !['yes', 'no'].includes(valueToken)) {
      return { outcome: 'unresolved', reason: 'missing threshold for cards market' };
    }

    const isRed = marketName.includes('red');
    const isYellow = marketName.includes('yellow');
    const cardType: 'yellow' | 'red' | 'any' = isRed ? 'red' : isYellow ? 'yellow' : 'any';

    const pair = parseCardStats(fixture, cardType);
    if (!pair) {
      return { outcome: 'unresolved', reason: 'missing card events' };
    }

    const { home: homeCards, away: awayCards } = pair;
    const totalCards = homeCards + awayCards;

    if (sideIsOverUnder && threshold !== null) {
      return evaluateOverUnder(sideIsOverUnder, threshold, totalCards, 'cards totals market');
    }

    const oddEven = evaluateOddEven(valueToken, totalCards, 'cards odd/even');
    if (oddEven) return oddEven;

    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: homeCards > awayCards ? 'won' : 'lost', reason: 'cards winner home' };
    if (side === 'away') return { outcome: awayCards > homeCards ? 'won' : 'lost', reason: 'cards winner away' };
    if (side === 'draw') return { outcome: awayCards === homeCards ? 'won' : 'lost', reason: 'cards winner draw' };

    return { outcome: 'unresolved', reason: 'unsupported cards market selection' };
  }

  if (
    marketName.includes('team to score') ||
    marketName.includes('team score a goal') ||
    marketName.includes('to score in both halves by teams') ||
    marketName.includes('will score in both halves')
  ) {
    const side = parseMarketSide(marketName) ?? parseSideFromSelection(selection.value);
    if (!side || side === 'draw') return { outcome: 'unresolved', reason: 'team score market side unsupported' };

    if (marketName.includes('both halves')) {
      const scoredBothHalves = didTeamScoreInBothHalves(side, ht, sh);
      if (scoredBothHalves === null) return { outcome: 'unresolved', reason: 'missing half scores for both-halves scoring market' };
      if (valueToken === 'yes') return { outcome: scoredBothHalves ? 'won' : 'lost', reason: 'team score in both halves yes/no' };
      if (valueToken === 'no') return { outcome: scoredBothHalves ? 'lost' : 'won', reason: 'team score in both halves yes/no' };
      return { outcome: scoredBothHalves ? 'won' : 'lost', reason: 'team score in both halves' };
    }

    const scored = didTeamScoreByScope(side, marketName, ft, ht, sh);
    if (scored === null) return { outcome: 'unresolved', reason: 'missing scoped score for team score market' };
    if (valueToken === 'yes') return { outcome: scored ? 'won' : 'lost', reason: 'team to score yes/no' };
    if (valueToken === 'no') return { outcome: scored ? 'lost' : 'won', reason: 'team to score yes/no' };
    return { outcome: scored ? 'won' : 'lost', reason: 'team to score side market' };
  }

  if (marketName.includes('team goals')) {
    const side = marketName.includes('away') ? 'away' : 'home';
    const goals = side === 'away' ? ft.away : ft.home;
    const oddEven = evaluateOddEven(valueToken, goals, 'team goals odd/even');
    if (oddEven) return oddEven;

    if (threshold !== null && sideIsOverUnder) {
      return evaluateOverUnder(sideIsOverUnder, threshold, goals, 'team goals totals market');
    }

    const range = parseGoalsRange(selection.value);
    if (range) {
      const inRange = goals >= range.min && goals <= range.max;
      return { outcome: inRange ? 'won' : 'lost', reason: 'team goals exact/range market' };
    }
  }

  if (marketName.includes('team performances') && marketName.includes('(range)')) {
    const range = parseGoalsRange(selection.value);
    if (!range) {
      return { outcome: 'unresolved', reason: 'team performances range parse failed' };
    }

    const side = parseMarketSide(marketName) ?? parseSideFromSelection(selection.value);
    const target = side === 'home'
      ? ft.home
      : side === 'away'
        ? ft.away
        : ft.home + ft.away;
    const inRange = target >= range.min && target <= range.max;
    return { outcome: inRange ? 'won' : 'lost', reason: 'team performances range' };
  }

  if (marketName.includes('late goal') || marketName.includes('early goal')) {
    const goalEvents = getOrderedGoalEvents(fixture.events);
    const yesNo = parseYesNoToken(selection.value);
    const hasGoal = goalEvents.length > 0;

    if (yesNo === 'yes') {
      return { outcome: hasGoal ? 'won' : 'lost', reason: 'late/early goal yes/no' };
    }
    if (yesNo === 'no') {
      return { outcome: hasGoal ? 'lost' : 'won', reason: 'late/early goal yes/no' };
    }

    if (!hasGoal) {
      return { outcome: 'unresolved', reason: 'missing goal events for late/early goal market' };
    }

    const targetGoal = marketName.includes('late goal')
      ? goalEvents[goalEvents.length - 1]
      : goalEvents[0];
    const minute = parseMaybeNumber(targetGoal.time?.elapsed);
    if (minute === null) {
      return { outcome: 'unresolved', reason: 'missing goal minute for late/early goal market' };
    }

    const minuteWindow = extractMinuteWindowFromText(selection.value);
    if (minuteWindow) {
      const inWindow = minute >= minuteWindow.start && minute <= minuteWindow.end;
      return { outcome: inWindow ? 'won' : 'lost', reason: 'late/early goal minute range' };
    }

    const threshold = extractNumberFromText(selection.value);
    if (threshold !== null) {
      if (valueToken.includes('over') || valueToken.includes('after')) {
        return { outcome: minute > threshold ? 'won' : 'lost', reason: 'late/early goal minute threshold' };
      }
      if (valueToken.includes('under') || valueToken.includes('before')) {
        return { outcome: minute < threshold ? 'won' : 'lost', reason: 'late/early goal minute threshold' };
      }
      return { outcome: minute === threshold ? 'won' : 'lost', reason: 'late/early goal minute exact' };
    }
  }

  if (
    marketName.includes('to score two or more goals') ||
    marketName.includes('to score three or more goals')
  ) {
    const required = marketName.includes('three or more') ? 3 : 2;
    const sideFromMarket = parseMarketSide(marketName);
    if (sideFromMarket) {
      const target = sideFromMarket === 'home' ? ft.home : ft.away;
      const ok = target >= required;
      const yesNo = parseYesNoToken(selection.value);
      if (yesNo === 'yes') return { outcome: ok ? 'won' : 'lost', reason: 'team to score goals threshold' };
      if (yesNo === 'no') return { outcome: ok ? 'lost' : 'won', reason: 'team to score goals threshold' };
      return { outcome: ok ? 'won' : 'lost', reason: 'team to score goals threshold' };
    }

    const side = parseSideFromSelection(selection.value);
    if (side === 'home' || side === 'away') {
      const target = side === 'home' ? ft.home : ft.away;
      return { outcome: target >= required ? 'won' : 'lost', reason: 'selection team goals threshold' };
    }

    const eitherTeam = ft.home >= required || ft.away >= required;
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: eitherTeam ? 'won' : 'lost', reason: 'either team goals threshold' };
    if (yesNo === 'no') return { outcome: eitherTeam ? 'lost' : 'won', reason: 'either team goals threshold' };
  }

  if (marketName.includes('to score in 1st half') || marketName.includes('to score in 2nd half')) {
    const scoped = marketName.includes('1st half') ? ht : sh;
    if (!scoped) return { outcome: 'unresolved', reason: 'missing half score for to-score-half market' };
    const hasGoal = scoped.home + scoped.away > 0;
    const yesNo = parseYesNoToken(selection.value);
    if (!yesNo) return { outcome: hasGoal ? 'won' : 'lost', reason: 'to score in half' };
    return { outcome: yesNo === 'yes' ? (hasGoal ? 'won' : 'lost') : hasGoal ? 'lost' : 'won', reason: 'to score in half yes/no' };
  }

  if (marketName.includes('to score in both halves')) {
    if (!ht || !sh) return { outcome: 'unresolved', reason: 'missing half scores for both-halves market' };
    const hasGoalBothHalves = ht.home + ht.away > 0 && sh.home + sh.away > 0;
    const yesNo = parseYesNoToken(selection.value);
    if (!yesNo) return { outcome: hasGoalBothHalves ? 'won' : 'lost', reason: 'to score in both halves' };
    return {
      outcome: yesNo === 'yes' ? (hasGoalBothHalves ? 'won' : 'lost') : hasGoalBothHalves ? 'lost' : 'won',
      reason: 'to score in both halves yes/no',
    };
  }

  if (marketName.includes('either half')) {
    if (!ht || !sh) return { outcome: 'unresolved', reason: 'missing half scores for either-half market' };
    const side = parseSideFromSelection(selection.value);
    if (!side || side === 'draw') return { outcome: 'unresolved', reason: 'unsupported either-half side' };

    const homeWinsEither = ht.home > ht.away || sh.home > sh.away;
    const awayWinsEither = ht.away > ht.home || sh.away > sh.home;
    const winsEither = side === 'home' ? homeWinsEither : awayWinsEither;
    return { outcome: winsEither ? 'won' : 'lost', reason: 'to win either half' };
  }

  if (marketName.includes('highest scoring half')) {
    if (!ht || !sh) return { outcome: 'unresolved', reason: 'missing half scores for highest-scoring-half market' };
    const firstHalfGoals = ht.home + ht.away;
    const secondHalfGoals = sh.home + sh.away;
    if (valueToken.includes('first') || valueToken.includes('1st')) {
      return { outcome: firstHalfGoals > secondHalfGoals ? 'won' : 'lost', reason: 'highest scoring half first' };
    }
    if (valueToken.includes('second') || valueToken.includes('2nd')) {
      return { outcome: secondHalfGoals > firstHalfGoals ? 'won' : 'lost', reason: 'highest scoring half second' };
    }
    if (valueToken === 'draw' || valueToken === 'equal') {
      return { outcome: firstHalfGoals === secondHalfGoals ? 'won' : 'lost', reason: 'highest scoring half draw' };
    }
  }

  if (marketName.includes('win both halves')) {
    const fixedSide = parseMarketSide(marketName);
    const side = fixedSide ?? parseSideFromSelection(selection.value);
    if (!side || side === 'draw') return { outcome: 'unresolved', reason: 'win both halves side unsupported' };
    const winBothHalves = didTeamWinBothHalves(side, ht, sh);
    if (winBothHalves === null) return { outcome: 'unresolved', reason: 'missing half scores for win both halves' };
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: winBothHalves ? 'won' : 'lost', reason: 'win both halves yes/no' };
    if (yesNo === 'no') return { outcome: winBothHalves ? 'lost' : 'won', reason: 'win both halves yes/no' };
    return { outcome: winBothHalves ? 'won' : 'lost', reason: 'win both halves' };
  }

  if (marketName.includes('come from behind')) {
    const side = parseMarketSide(marketName);
    if (!side) return { outcome: 'unresolved', reason: 'missing side for come from behind market' };
    const trailingAtHalf = wasTeamTrailingAtHalf(side, ht);
    if (trailingAtHalf === null) return { outcome: 'unresolved', reason: 'missing halftime score for come from behind market' };
    if (marketName.includes('and win')) {
      const won = didTeamWinFullTime(side, ft);
      return { outcome: trailingAtHalf && won ? 'won' : 'lost', reason: 'come from behind and win' };
    }
    if (marketName.includes('and draw')) {
      const drew = didTeamDrawFullTime(side, ft);
      return { outcome: trailingAtHalf && drew ? 'won' : 'lost', reason: 'come from behind and draw' };
    }
  }

  if (marketName.includes('to win from behind')) {
    if (!ht) return { outcome: 'unresolved', reason: 'missing halftime score for win from behind' };
    const homeFromBehind = ht.home < ht.away && ft.home > ft.away;
    const awayFromBehind = ht.away < ht.home && ft.away > ft.home;
    const yesNo = parseYesNoToken(selection.value);
    const fromBehind = homeFromBehind || awayFromBehind;
    if (yesNo === 'yes') return { outcome: fromBehind ? 'won' : 'lost', reason: 'to win from behind yes/no' };
    if (yesNo === 'no') return { outcome: fromBehind ? 'lost' : 'won', reason: 'to win from behind yes/no' };
    return { outcome: fromBehind ? 'won' : 'lost', reason: 'to win from behind' };
  }

  if (marketName.includes('winning margin')) {
    const margin = Math.abs(ft.home - ft.away);
    const winner = scoreWinner(ft.home, ft.away);
    if (valueToken.includes('score draw')) {
      return { outcome: ft.home === ft.away && ft.home > 0 ? 'won' : 'lost', reason: 'winning margin score draw' };
    }
    if (valueToken === 'draw') {
      return { outcome: ft.home === ft.away ? 'won' : 'lost', reason: 'winning margin draw' };
    }

    const byMatch = valueToken.match(/([12]|home|away)\s*by\s*(\d+|\d+\+)/);
    if (byMatch) {
      const sideToken = byMatch[1];
      const side: 'home' | 'away' = sideToken === '2' || sideToken === 'away' ? 'away' : 'home';
      const expectedWinner = side === 'home' ? 'home' : 'away';
      const marginToken = byMatch[2];
      const atLeast = marginToken.endsWith('+');
      const value = Number(marginToken.replace('+', ''));
      const marginOk = atLeast ? margin >= value : margin === value;
      const winnerOk = winner === expectedWinner;
      return { outcome: winnerOk && marginOk ? 'won' : 'lost', reason: 'winning margin side by margin' };
    }
  }

  if (marketName.includes('either team wins by')) {
    const goalMargin = Math.abs(ft.home - ft.away);
    const needed = extractNumberFromText(marketName);
    if (needed === null) return { outcome: 'unresolved', reason: 'missing margin for either-team-wins-by market' };
    return { outcome: goalMargin === needed ? 'won' : 'lost', reason: 'either team wins by margin' };
  }

  if (marketName.includes('scoring draw')) {
    const scoringDraw = ft.home === ft.away && ft.home > 0;
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: scoringDraw ? 'won' : 'lost', reason: 'scoring draw yes/no' };
    if (yesNo === 'no') return { outcome: scoringDraw ? 'lost' : 'won', reason: 'scoring draw yes/no' };
    return { outcome: scoringDraw ? 'won' : 'lost', reason: 'scoring draw' };
  }

  if (marketName.includes('team to score first') || marketName.includes('which team will score the 1st goal')) {
    const goalEvents = getOrderedGoalEvents(fixture.events);
    if (goalEvents.length === 0) {
      const yesNo = parseYesNoToken(selection.value);
      if (yesNo === 'no') return { outcome: 'won', reason: 'no first scorer event' };
      return { outcome: 'unresolved', reason: 'missing goal events for first-team-to-score market' };
    }
    const firstGoal = goalEvents[0];
    const scorerTeamId = parseMaybeNumber(firstGoal.team?.id);
    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: scorerTeamId === homeId ? 'won' : 'lost', reason: 'first team to score' };
    if (side === 'away') return { outcome: scorerTeamId === awayId ? 'won' : 'lost', reason: 'first team to score' };
    if (parseNoGoalToken(selection.value) || valueToken === 'draw') {
      return { outcome: 'lost', reason: 'first team to score no-goal token with scored match' };
    }
  }

  if (marketName.includes('team to score last')) {
    const goalEvents = getOrderedGoalEvents(fixture.events);
    if (goalEvents.length === 0) {
      const yesNo = parseYesNoToken(selection.value);
      if (yesNo === 'no') return { outcome: 'won', reason: 'no last scorer event' };
      return { outcome: 'unresolved', reason: 'missing goal events for last-team-to-score market' };
    }
    const lastGoal = goalEvents[goalEvents.length - 1];
    const scorerTeamId = parseMaybeNumber(lastGoal.team?.id);
    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: scorerTeamId === homeId ? 'won' : 'lost', reason: 'last team to score' };
    if (side === 'away') return { outcome: scorerTeamId === awayId ? 'won' : 'lost', reason: 'last team to score' };
    if (parseNoGoalToken(selection.value) || valueToken === 'draw') {
      return { outcome: 'lost', reason: 'last team to score no-goal token with scored match' };
    }
  }

  if (marketName.includes('goal method')) {
    const goalEvents = getOrderedGoalEvents(fixture.events);
    if (goalEvents.length === 0) return { outcome: 'unresolved', reason: 'missing goal events for goal method market' };
    const teamFromMarket = parseMarketSide(marketName);
    const filteredEvents = teamFromMarket
      ? goalEvents.filter((event) => parseMaybeNumber(event.team?.id) === (teamFromMarket === 'home' ? homeId : awayId))
      : goalEvents;

    const isHeader = marketName.includes('header');
    const isOutside = marketName.includes('outside');
    const methodMatched = filteredEvents.some((event) => {
      const detail = normalizeText(event.detail);
      if (isHeader) return detail.includes('header');
      if (isOutside) return detail.includes('outside');
      return false;
    });
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: methodMatched ? 'won' : 'lost', reason: 'goal method yes/no' };
    if (yesNo === 'no') return { outcome: methodMatched ? 'lost' : 'won', reason: 'goal method yes/no' };
    return { outcome: methodMatched ? 'won' : 'lost', reason: 'goal method' };
  }

  if (marketName.includes('own goal')) {
    const ownGoal = (fixture.events ?? []).some((event) =>
      normalizeText(event.detail).includes('own goal'),
    );
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: ownGoal ? 'won' : 'lost', reason: 'own goal yes/no' };
    if (yesNo === 'no') return { outcome: ownGoal ? 'lost' : 'won', reason: 'own goal yes/no' };
    return { outcome: ownGoal ? 'won' : 'lost', reason: 'own goal' };
  }

  if (
    marketName.includes('penalty awarded') ||
    marketName.includes('to score a penalty') ||
    marketName.includes('to miss a penalty')
  ) {
    const penaltyEvents = (fixture.events ?? []).filter((event) => {
      const detail = normalizeText(event.detail);
      const type = normalizeText(event.type);
      return detail.includes('penalty') || type.includes('penalty');
    });
    if (!fixture.events || fixture.events.length === 0) {
      return { outcome: 'unresolved', reason: 'missing events for penalty market' };
    }

    const scopedPenaltyEvents = penaltyEvents.filter((event) => {
      const elapsed = parseMaybeNumber(event.time?.elapsed);
      if (elapsed === null) return true;
      if (marketName.includes('1st half')) return elapsed <= 45;
      if (marketName.includes('2nd half')) return elapsed > 45;
      return true;
    });

    const hasAwardedPenalty = scopedPenaltyEvents.length > 0;
    const hasScoredPenalty = scopedPenaltyEvents.some((event) =>
      normalizeText(event.detail).includes('penalty'),
    );
    const hasMissedPenalty = scopedPenaltyEvents.some((event) => {
      const detail = normalizeText(event.detail);
      return detail.includes('missed penalty') || detail.includes('penalty missed');
    });

    const yesNo = parseYesNoToken(selection.value);
    if (marketName.includes('to miss a penalty')) {
      if (yesNo === 'yes') return { outcome: hasMissedPenalty ? 'won' : 'lost', reason: 'missed penalty yes/no' };
      if (yesNo === 'no') return { outcome: hasMissedPenalty ? 'lost' : 'won', reason: 'missed penalty yes/no' };
      return { outcome: hasMissedPenalty ? 'won' : 'lost', reason: 'missed penalty' };
    }
    if (marketName.includes('to score a penalty')) {
      if (yesNo === 'yes') return { outcome: hasScoredPenalty ? 'won' : 'lost', reason: 'scored penalty yes/no' };
      if (yesNo === 'no') return { outcome: hasScoredPenalty ? 'lost' : 'won', reason: 'scored penalty yes/no' };
      return { outcome: hasScoredPenalty ? 'won' : 'lost', reason: 'scored penalty' };
    }
    if (yesNo === 'yes') return { outcome: hasAwardedPenalty ? 'won' : 'lost', reason: 'penalty awarded yes/no' };
    if (yesNo === 'no') return { outcome: hasAwardedPenalty ? 'lost' : 'won', reason: 'penalty awarded yes/no' };
    return { outcome: hasAwardedPenalty ? 'won' : 'lost', reason: 'penalty awarded' };
  }

  if (marketName.includes('race to') || marketName.includes('rtg_h1')) {
    const targetFromMarket = (() => {
      if (marketName.includes('3rd')) return 3;
      if (marketName.includes('2nd')) return 2;
      if (marketName.includes('rtg_h1')) return 1;
      const parsed = extractNumberFromText(selection.value);
      if (parsed !== null && Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
      return 1;
    })();

    const goals = getOrderedGoalEvents(fixture.events);
    if (goals.length === 0) return { outcome: 'unresolved', reason: 'missing goal events for race-to market' };
    const goalTimeline = marketName.includes('rtg_h1')
      ? goals.filter((event) => (parseMaybeNumber(event.time?.elapsed) ?? 0) <= 45)
      : goals;

    let homeGoals = 0;
    let awayGoals = 0;
    let winner: 'home' | 'away' | null = null;
    for (const event of goalTimeline) {
      const teamId = parseMaybeNumber(event.team?.id);
      if (teamId === homeId) homeGoals += 1;
      if (teamId === awayId) awayGoals += 1;
      if (homeGoals >= targetFromMarket) {
        winner = 'home';
        break;
      }
      if (awayGoals >= targetFromMarket) {
        winner = 'away';
        break;
      }
    }

    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: winner === 'home' ? 'won' : 'lost', reason: 'race to goals home' };
    if (side === 'away') return { outcome: winner === 'away' ? 'won' : 'lost', reason: 'race to goals away' };
    if (valueToken.includes('none') || valueToken.includes('neither') || valueToken.includes('draw')) {
      return { outcome: winner === null ? 'won' : 'lost', reason: 'race to goals neither' };
    }
  }

  if (marketName.includes('time of 1st score')) {
    const firstGoal = getOrderedGoalEvents(fixture.events)[0];
    if (!firstGoal) return { outcome: 'unresolved', reason: 'missing first goal event for first-score-time market' };
    const elapsed = parseMaybeNumber(firstGoal.time?.elapsed);
    if (elapsed === null) return { outcome: 'unresolved', reason: 'missing event minute for first-score-time market' };
    const window = extractMinuteWindowFromText(selection.value);
    if (!window) return { outcome: 'unresolved', reason: 'minute range parse failed for first-score-time market' };
    return { outcome: elapsed >= window.start && elapsed <= window.end ? 'won' : 'lost', reason: 'first-score-time range' };
  }

  if (marketName.includes('to qualify') || marketName.includes('to advance')) {
    const penalty = fixture.score?.penalty;
    const extra = fixture.score?.extratime;
    const penHome = parseMaybeNumber(penalty?.home);
    const penAway = parseMaybeNumber(penalty?.away);
    const etHome = parseMaybeNumber(extra?.home);
    const etAway = parseMaybeNumber(extra?.away);
    let qualified: 'home' | 'away' | null = null;

    if (penHome !== null && penAway !== null && penHome !== penAway) {
      qualified = penHome > penAway ? 'home' : 'away';
    } else if (etHome !== null && etAway !== null && etHome !== etAway) {
      qualified = etHome > etAway ? 'home' : 'away';
    } else if (ft.home !== ft.away) {
      qualified = ft.home > ft.away ? 'home' : 'away';
    }

    if (!qualified) return { outcome: 'unresolved', reason: 'cannot determine qualifier from fixture data' };
    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: qualified === 'home' ? 'won' : 'lost', reason: 'to qualify home' };
    if (side === 'away') return { outcome: qualified === 'away' ? 'won' : 'lost', reason: 'to qualify away' };
  }

  if (marketName.includes('game decided after penalties')) {
    const decidedByPenalties =
      fixture.statusShort === 'PEN' ||
      (parseMaybeNumber(fixture.score?.penalty?.home) !== null &&
        parseMaybeNumber(fixture.score?.penalty?.away) !== null);
    const yesNo = parseYesNoToken(selection.value);
    if (yesNo === 'yes') return { outcome: decidedByPenalties ? 'won' : 'lost', reason: 'decided after penalties yes/no' };
    if (yesNo === 'no') return { outcome: decidedByPenalties ? 'lost' : 'won', reason: 'decided after penalties yes/no' };
    return { outcome: decidedByPenalties ? 'won' : 'lost', reason: 'decided after penalties' };
  }

  if (marketName.includes('game decided in extra time') || marketName.includes('method of victory')) {
    const decidedByPenalties =
      fixture.statusShort === 'PEN' ||
      (parseMaybeNumber(fixture.score?.penalty?.home) !== null &&
        parseMaybeNumber(fixture.score?.penalty?.away) !== null);
    const decidedByEt =
      fixture.statusShort === 'AET' ||
      (parseMaybeNumber(fixture.score?.extratime?.home) !== null &&
        parseMaybeNumber(fixture.score?.extratime?.away) !== null &&
        parseMaybeNumber(fixture.score?.extratime?.home) !== parseMaybeNumber(fixture.score?.fulltime?.home));
    const yesNo = parseYesNoToken(selection.value);
    if (marketName.includes('method of victory')) {
      const token = normalizeText(selection.value);
      const isEt = token.includes('extra');
      const isPen = token.includes('pen');
      const isRegular = token.includes('regular') || token.includes('normal');
      if (isEt) return { outcome: decidedByEt ? 'won' : 'lost', reason: 'method of victory extra time' };
      if (isPen) return { outcome: decidedByPenalties ? 'won' : 'lost', reason: 'method of victory penalties' };
      if (isRegular) return { outcome: !decidedByEt && !decidedByPenalties ? 'won' : 'lost', reason: 'method of victory regular time' };
    }
    if (yesNo === 'yes') return { outcome: decidedByEt ? 'won' : 'lost', reason: 'decided in extra time yes/no' };
    if (yesNo === 'no') return { outcome: decidedByEt ? 'lost' : 'won', reason: 'decided in extra time yes/no' };
    return { outcome: decidedByEt ? 'won' : 'lost', reason: 'decided in extra time' };
  }

  if (
    marketName.includes('offside') ||
    marketName.includes('foul') ||
    marketName.includes('shotontarget') ||
    marketName.includes('shots.1x2') ||
    marketName.includes('goalkeeper saves') ||
    marketName.includes('save')
  ) {
    const pair = getMetricPairForMarket(fixture, marketName);
    if (!pair) return { outcome: 'unresolved', reason: 'missing fixture statistics for metric market' };
    const { home, away } = pair;
    const total = home + away;

    if (sideIsOverUnder && threshold !== null) {
      if (marketName.includes('home')) {
        return evaluateOverUnder(sideIsOverUnder, threshold, home, 'metric home totals market');
      }
      if (marketName.includes('away')) {
        return evaluateOverUnder(sideIsOverUnder, threshold, away, 'metric away totals market');
      }
      return evaluateOverUnder(sideIsOverUnder, threshold, total, 'metric totals market');
    }

    const oddEven = evaluateOddEven(valueToken, total, 'metric odd/even');
    if (oddEven) return oddEven;

    const dc = evaluateDoubleChanceToken(valueToken, home, away);
    if (dc) return dc;

    if (marketName.includes('handicap')) {
      const side = parseSideFromSelection(selection.value);
      if (!side || side === 'draw' || threshold === null) {
        return { outcome: 'unresolved', reason: 'metric handicap parse failed' };
      }
      const adjusted = side === 'home' ? home - away + threshold : away - home + threshold;
      if (adjusted > 0) return { outcome: 'won', reason: 'metric handicap' };
      if (adjusted < 0) return { outcome: 'lost', reason: 'metric handicap' };
      return { outcome: 'void', reason: 'metric handicap push' };
    }

    const side = parseSideFromSelection(selection.value);
    if (side === 'home') return { outcome: home > away ? 'won' : 'lost', reason: 'metric 1x2 home' };
    if (side === 'away') return { outcome: away > home ? 'won' : 'lost', reason: 'metric 1x2 away' };
    if (side === 'draw') return { outcome: home === away ? 'won' : 'lost', reason: 'metric 1x2 draw' };
  }

  const homeWinner = evaluateWinnerToken(valueToken, ft.home, ft.away);
  if (homeWinner) return homeWinner;

  return { outcome: 'unresolved', reason: `unsupported market: ${marketNameRaw || 'unknown'}` };
};

const resolveByValueOnly = (
  selection: SelectionSettlementInput,
  fixture: FixtureSettlementContext,
): SelectionSettlementResult => {
  const value = normalizeText(selection.value);
  const ft = getFulltimeGoals(fixture);
  if (!ft) return { outcome: 'unresolved', reason: 'missing final score' };

  const winnerResult = evaluateWinnerToken(value, ft.home, ft.away);
  if (winnerResult) return winnerResult;

  const doubleChance = evaluateDoubleChanceToken(value, ft.home, ft.away);
  if (doubleChance) return doubleChance;

  if (value === 'yes' || value === 'no') {
    const scoredByBoth = ft.home > 0 && ft.away > 0;
    return {
      outcome: value === 'yes' ? (scoredByBoth ? 'won' : 'lost') : scoredByBoth ? 'lost' : 'won',
      reason: 'yes/no fallback',
    };
  }

  const threshold = getThreshold(selection);
  if (threshold !== null && (value.includes('over') || value.includes('under'))) {
    return evaluateOverUnder(value.includes('over') ? 'over' : 'under', threshold, ft.home + ft.away, 'over/under fallback');
  }

  const oddEven = evaluateOddEven(value, ft.home + ft.away, 'odd/even fallback');
  if (oddEven) return oddEven;

  return { outcome: 'unresolved', reason: 'unsupported market with value-only fallback' };
};

export const resolveSelectionOutcome = (
  selection: SelectionSettlementInput,
  fixture: FixtureSettlementContext,
): SelectionSettlementResult => {
  if (!isFinalStatus(fixture.statusShort)) {
    return { outcome: 'unresolved', reason: `fixture not final (${fixture.statusShort ?? 'unknown'})` };
  }

  const marketName = String(selection.marketName ?? '').trim();
  if (marketName.length > 0) {
    return resolveByMarketName(selection, fixture, marketName);
  }

  return resolveByValueOnly(selection, fixture);
};

export const resolveBetOutcome = (
  selections: SelectionSettlementInput[],
  fixtureById: Map<number, FixtureSettlementContext>,
  stake: number,
): {
  outcome: 'won' | 'lost' | 'void' | 'unresolved';
  payout: number | null;
  lines: Array<{ selection: SelectionSettlementInput; result: SelectionSettlementResult }>;
} => {
  const lineResults = selections.map((selection) => {
    const fixture = fixtureById.get(Number(selection.fixtureId));
    if (!fixture) {
      return {
        selection,
        result: { outcome: 'unresolved' as const, reason: 'fixture context missing' },
      };
    }
    return {
      selection,
      result: resolveSelectionOutcome(selection, fixture),
    };
  });

  const results = lineResults.map((line) => line.result.outcome);
  if (results.includes('unresolved')) {
    return { outcome: 'unresolved', payout: null, lines: lineResults };
  }

  if (results.includes('lost')) {
    return { outcome: 'lost', payout: 0, lines: lineResults };
  }

  if (results.every((result) => result === 'void')) {
    return { outcome: 'void', payout: stake, lines: lineResults };
  }

  const effectiveOdds = selections.reduce((acc, selection, index) => {
    const result = lineResults[index].result.outcome;
    if (result === 'void') return acc;
    const odd = parseMaybeNumber(selection.odd);
    if (odd === null || odd <= 0) return acc;
    return acc * odd;
  }, 1);

  const payout = Number((stake * effectiveOdds).toFixed(2));
  return { outcome: 'won', payout, lines: lineResults };
};

export const shouldFetchStatisticsForMarket = (marketNameRaw: string): boolean => {
  const marketName = normalizeText(marketNameRaw);
  return (
    marketName.includes('corner') ||
    marketName.includes('offside') ||
    marketName.includes('foul') ||
    marketName.includes('shotontarget') ||
    marketName.includes('shots.1x2') ||
    marketName.includes('shots on target') ||
    marketName.includes('total shots') ||
    marketName.includes('save') ||
    marketName.includes('goalkeeper')
  );
};

export const shouldFetchEventsForMarket = (marketNameRaw: string): boolean => {
  const marketName = normalizeText(marketNameRaw);
  return (
    marketName.includes('card') ||
    marketName.includes('booking') ||
    marketName.includes('player') ||
    marketName.includes('scorer') ||
    marketName.includes('first goal') ||
    marketName.includes('last goal') ||
    marketName.includes('goal in') ||
    marketName.includes('race to') ||
    marketName.includes('rtg_h1') ||
    marketName.includes('time of 1st score') ||
    marketName.includes('late goal') ||
    marketName.includes('early goal') ||
    marketName.includes('which team will score the 1st goal') ||
    marketName.includes('penalty') ||
    marketName.includes('own goal') ||
    marketName.includes('goal method') ||
    marketName.includes('1x2 -') ||
    marketName.includes('dc -') ||
    marketName.includes('over/under 15m') ||
    marketName.includes('over/under 30m')
  );
};

export const isMarketNameSupported = (marketNameRaw: string): boolean => {
  const marketName = normalizeText(marketNameRaw);
  if (!marketName) return true;
  if (
    marketName.includes('winner') ||
    marketName.includes('result') ||
    marketName.includes('double chance') ||
    marketName.includes('draw no bet') ||
    marketName.includes('no bet') ||
    marketName.includes('both teams to score') ||
    marketName.includes('both teams score') ||
    marketName.includes('btts') ||
    marketName.includes('odd/even') ||
    marketName.includes('exact score') ||
    marketName.includes('correct score') ||
    marketName.includes('exact goals number') ||
    marketName.includes('scoring draw') ||
    marketName.includes('number of goals in match') ||
    marketName.includes('player') ||
    marketName.includes('scorer') ||
    marketName.includes('handicap') ||
    marketName.includes('total') ||
    marketName.includes('over/under') ||
    marketName.includes('goals over/under') ||
    marketName.includes('goal line') ||
    marketName.includes('corner') ||
    marketName.includes('card') ||
    marketName.includes('booking') ||
    marketName.includes('offside') ||
    marketName.includes('foul') ||
    marketName.includes('shot') ||
    marketName.includes('save') ||
    marketName.includes('team to score') ||
    marketName.includes('team score a goal') ||
    marketName.includes('will score in both halves') ||
    marketName.includes('team goals') ||
    marketName.includes('to score') ||
    marketName.includes('which team will score the 1st goal') ||
    marketName.includes('win to nil') ||
    marketName.includes('clean sheet') ||
    marketName.includes('either half') ||
    marketName.includes('highest scoring half') ||
    marketName.includes('first goal') ||
    marketName.includes('last goal') ||
    marketName.includes('half time/full time') ||
    marketName.includes('ht/ft') ||
    marketName.includes('to qualify') ||
    marketName.includes('to advance') ||
    marketName.includes('win both halves') ||
    marketName.includes('winning margin') ||
    marketName.includes('come from behind') ||
    marketName.includes('from behind') ||
    marketName.includes('race to') ||
    marketName.includes('rtg_h1') ||
    marketName.includes('penalty') ||
    marketName.includes('goal method') ||
    marketName.includes('own goal') ||
    marketName.includes('method of victory') ||
    marketName.includes('game decided') ||
    marketName.includes('time of 1st score') ||
    marketName.includes('set piece') ||
    marketName.includes('win/over') ||
    marketName.includes('win/under') ||
    marketName.includes('not lose/over') ||
    marketName.includes('not lose/under') ||
    marketName.includes('goal in') ||
    marketName.includes('either team wins by') ||
    marketName.includes('team performances') ||
    marketName.includes('late goal') ||
    marketName.includes('early goal')
  ) {
    return true;
  }

  if (
    /^1x2\s*-\s*\d+/.test(marketName) ||
    /^dc\s*-\s*\d+/.test(marketName) ||
    marketName.includes('home/away')
  ) {
    return true;
  }

  return false;
};
