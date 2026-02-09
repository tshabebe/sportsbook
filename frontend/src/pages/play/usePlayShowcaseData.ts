import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useLiveMatches, usePreMatchFixtures, type Fixture } from '../../hooks/useFootball';

type LeagueBucket = {
  leagueName: string;
  logo: string;
  count: number;
  avgHomeOdd: number;
  fixtures: Fixture[];
};

export function usePlayShowcaseData() {
  const preMatchQuery = usePreMatchFixtures(0);
  const liveQuery = useLiveMatches();

  const prematch = (preMatchQuery.data ?? []).slice(0, 60);
  const live = (liveQuery.data ?? []).slice(0, 24);

  const leagueBuckets = useMemo<LeagueBucket[]>(() => {
    const map = new Map<string, LeagueBucket>();
    for (const fixture of prematch) {
      const key = fixture.league.name;
      const existing = map.get(key);
      const homeOdd = Number(fixture.odds.home || '1');
      if (!existing) {
        map.set(key, {
          leagueName: key,
          logo: fixture.league.logo,
          count: 1,
          avgHomeOdd: homeOdd,
          fixtures: [fixture],
        });
        continue;
      }
      existing.count += 1;
      existing.avgHomeOdd = (existing.avgHomeOdd * (existing.count - 1) + homeOdd) / existing.count;
      existing.fixtures.push(fixture);
    }

    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [prematch]);

  const kickoffTimeline = useMemo(() => {
    const bucket = new Map<string, Fixture[]>();
    for (const fixture of prematch.slice(0, 24)) {
      const hourKey = dayjs(fixture.fixture.date).format('ddd HH:00');
      const entries = bucket.get(hourKey) ?? [];
      entries.push(fixture);
      bucket.set(hourKey, entries);
    }
    return [...bucket.entries()].map(([slot, fixtures]) => ({ slot, fixtures }));
  }, [prematch]);

  const featured = prematch[0] ?? live[0] ?? null;
  const nextKickoff = prematch[0] ?? null;

  return {
    prematch,
    live,
    featured,
    nextKickoff,
    leagueBuckets,
    kickoffTimeline,
    isLoading: preMatchQuery.isLoading || liveQuery.isLoading,
    hasError: Boolean(preMatchQuery.error),
  };
}
