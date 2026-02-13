import type { ApiBetSelectionInput, ApiBetSlipInput, ApiBetMode } from '../validation/bets';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

type NormalizedMode = {
  mode: ApiBetMode;
  systemSize?: number;
};

const resolveMode = (
  inputMode: ApiBetMode,
  selectionCount: number,
  requestedSystemSize?: number,
): NormalizedMode | null => {
  if (selectionCount <= 0) return null;

  if (inputMode === 'single') {
    return { mode: 'single' };
  }

  if (inputMode === 'multiple') {
    if (selectionCount >= 2) return { mode: 'multiple' };
    return { mode: 'single' };
  }

  // system mode
  if (selectionCount >= 3) {
    const boundedSystemSize = clamp(requestedSystemSize ?? 2, 2, selectionCount);
    return { mode: 'system', systemSize: boundedSystemSize };
  }

  if (selectionCount === 2) {
    return { mode: 'multiple' };
  }

  return { mode: 'single' };
};

export const normalizeSlipForSelections = (
  slip: ApiBetSlipInput,
  selections: ApiBetSelectionInput[],
): ApiBetSlipInput | null => {
  const mode = resolveMode(slip.mode, selections.length, slip.systemSize);
  if (!mode) return null;

  return {
    ...slip,
    selections,
    mode: mode.mode,
    systemSize: mode.systemSize,
  };
};
