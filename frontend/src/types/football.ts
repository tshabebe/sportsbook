export interface Fixture {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: { first: number | null; second: number | null };
    venue: { id: number | null; name: string; city: string };
    status: { long: string; short: string; elapsed: number | null };
}

export interface League {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
}

export interface Team {
    id: number;
    name: string;
    logo: string;
    winner: boolean | null;
}

export interface Teams {
    home: Team;
    away: Team;
}

export interface Goals {
    home: number | null;
    away: number | null;
}

export interface Score {
    halftime: Goals;
    fulltime: Goals;
    extratime: Goals;
    penalty: Goals;
}

export interface OddValue {
    value: string;
    odd: string;
    handicap?: string | null;
    main?: boolean | null;
    suspended?: boolean | null;
}

export interface Bet {
    id: number;
    name: string;
    values: OddValue[];
}

export interface OddResponse {
    league: { id: number; name: string; country: string; logo: string; flag: string | null; season: number };
    fixture: { id: number; timezone: string; date: string; timestamp: number };
    update: string;
    bookmakers: { id: number; name: string; bets: Bet[] }[];
}

export interface FixtureResponse {
    fixture: Fixture;
    league: League;
    teams: Teams;
    goals: Goals;
    score: Score;
    odds?: { id: number; name: string; values: OddValue[] }[]; // Often separate in "odds/live" but sometimes merged
}

export interface ApiFootballResponse<T> {
    get: string;
    parameters: any;
    errors: any[];
    results: number;
    paging: { current: number; total: number };
    response: T[];
}
