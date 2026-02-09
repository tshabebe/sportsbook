import { SportsbookIteration } from './SportsbookIteration';

export function PlayVariant5Page() {
  return (
    <SportsbookIteration
      config={{
        label: 'Iteration 5',
        title: 'Pro Compact Sportsbook',
        subtitle: 'Dense market list for experienced bettors with compact rows and immediate 1X2 action.',
        emphasizeLive: true,
        compactRows: true,
        splitLayout: true,
        showTopLeagues: false,
        showTrending: true,
        oddsLayout: 'compact',
      }}
    />
  );
}
