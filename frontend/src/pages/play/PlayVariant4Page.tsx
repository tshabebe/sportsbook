import { SportsbookIteration } from './SportsbookIteration';

export function PlayVariant4Page() {
  return (
    <SportsbookIteration
      config={{
        label: 'Iteration 4',
        title: 'Split Feed + Trending Rail',
        subtitle: 'Same IA with side insights and faster scan cards, similar to top sportsbook desktop rails.',
        emphasizeLive: false,
        compactRows: true,
        splitLayout: true,
        showTopLeagues: true,
        showTrending: true,
        oddsLayout: 'stacked',
      }}
    />
  );
}
