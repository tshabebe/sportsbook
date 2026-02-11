export const currencySymbol = 'Br';

export const formatCurrency = (value: number): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${formatter.format(value)}`;
};
