import dayjs from "dayjs";

/**
 * Calculates the current API-Football season year for a given league.
 * 
 * Logic:
 * - Most European leagues (PL, La Liga, UCL, etc.) run from August to May.
 * - The "season year" is the start year. 
 * - Example: Season 2025-2026 is season "2025".
 * 
 * Algorithm:
 * - If current month is Jan-June (0-5): Season = CurrentYear - 1
 * - If current month is July-Dec (6-11): Season = CurrentYear
 * 
 * @param leagueId - The ID of the league (optional, for future overrides)
 * @returns number - The 4-digit year (e.g., 2025)
 */
export const getCurrentSeason = (leagueId?: number): number => {
    // Current date
    const now = dayjs();
    const currentYear = now.year();
    const currentMonth = now.month(); // 0 = Jan, 11 = Dec

    // Special handling for leagues that strictly follow calendar year (e.g. MLS, Brazil, Norway)
    // Add IDs here if we ever support them (e.g. MLS = 253)
    const CALENDAR_YEAR_LEAGUES: number[] = [];

    if (leagueId && CALENDAR_YEAR_LEAGUES.includes(leagueId)) {
        return currentYear;
    }

    // Default: European/Winter Leagues (Aug - May)
    // Cutoff: July (Month 6) -> New season starts approx July 1st for data purposes
    if (currentMonth < 6) { // Jan - June
        return currentYear - 1;
    } else { // July - Dec
        return currentYear;
    }
};
