import { SportsbookIteration } from './SportsbookIteration';

export function PlayVariant2Page() {
  return (
    <SportsbookIteration
      config={{
        label: 'Iteration 2',
        title: 'Live Emphasis Feed',
        subtitle: 'Same sportsbook structure, tuned to prioritize in-play discovery and rapid odds taps.',
        emphasizeLive: true,
        compactRows: false,
        splitLayout: false,
        showTopLeagues: false,
        showTrending: false,
        oddsLayout: 'spotlight',
      }}
    />
  );
}
