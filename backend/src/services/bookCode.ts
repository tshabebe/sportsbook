export const generateRetailBookCode = (
  now: Date = new Date(),
  random: () => number = Math.random,
): string => {
  const day = String(now.getDate()).padStart(2, '0');
  const serial = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
  return `${day}-${serial}`;
};
