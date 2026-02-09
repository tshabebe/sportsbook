import { SportsbookIteration } from './SportsbookIteration';

export function PlayVariant1Page() {
  return (
    <SportsbookIteration
      config={{
        label: 'Iteration 1',
        title: 'Classic Sportsbook Feed',
        subtitle: 'Balanced pre-match first view with quick league filters and direct 1X2 actions.',
        emphasizeLive: false,
        compactRows: false,
        splitLayout: false,
        showTopLeagues: false,
        showTrending: false,
        oddsLayout: 'classic',
      }}
    />
  );
}
