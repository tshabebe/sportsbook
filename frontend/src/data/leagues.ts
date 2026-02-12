export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
}

export const PREMATCH_LEAGUES: League[] = [
  {
    id: 39,
    name: 'Premier League',
    country: 'England',
    logo: 'https://media.api-sports.io/football/leagues/39.png',
    flag: 'https://media.api-sports.io/flags/gb.svg',
  },
  {
    id: 2,
    name: 'UEFA Champions League',
    country: 'World',
    logo: 'https://media.api-sports.io/football/leagues/2.png',
    flag: 'https://media.api-sports.io/flags/world.svg',
  },
  {
    id: 140,
    name: 'La Liga',
    country: 'Spain',
    logo: 'https://media.api-sports.io/football/leagues/140.png',
    flag: 'https://media.api-sports.io/flags/es.svg',
  },
  {
    id: 45,
    name: 'FA Cup',
    country: 'England',
    logo: 'https://media.api-sports.io/football/leagues/45.png',
    flag: 'https://media.api-sports.io/flags/gb.svg',
  },
  {
    id: 61,
    name: 'Ligue 1',
    country: 'France',
    logo: 'https://media.api-sports.io/football/leagues/61.png',
    flag: 'https://media.api-sports.io/flags/fr.svg',
  },
  {
    id: 88,
    name: 'Eredivisie',
    country: 'Netherlands',
    logo: 'https://media.api-sports.io/football/leagues/88.png',
    flag: 'https://media.api-sports.io/flags/nl.svg',
  },
  {
    id: 78,
    name: 'Bundesliga',
    country: 'Germany',
    logo: 'https://media.api-sports.io/football/leagues/78.png',
    flag: 'https://media.api-sports.io/flags/de.svg',
  },
  {
    id: 135,
    name: 'Serie A',
    country: 'Italy',
    logo: 'https://media.api-sports.io/football/leagues/135.png',
    flag: 'https://media.api-sports.io/flags/it.svg',
  },
  {
    id: 40,
    name: 'Championship',
    country: 'England',
    logo: 'https://media.api-sports.io/football/leagues/40.png',
    flag: 'https://media.api-sports.io/flags/gb.svg',
  },
];

export const LEAGUES: League[] = [
  { id: 0, name: 'All Leagues', country: '', logo: '', flag: '' },
  ...PREMATCH_LEAGUES,
];

export const PREMATCH_LEAGUE_IDS = PREMATCH_LEAGUES.map((league) => league.id);
