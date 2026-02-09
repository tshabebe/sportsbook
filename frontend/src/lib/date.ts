import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const formatFixtureTime = (iso: string): string =>
  dayjs(iso).tz(dayjs.tz.guess()).format('HH:mm');

export const formatFixtureDate = (iso: string): string =>
  dayjs(iso).tz(dayjs.tz.guess()).format('DD MMM');

export const isPastIso = (iso: string): boolean => dayjs(iso).isBefore(dayjs());

export const compareIsoAsc = (a: string, b: string): number =>
  dayjs(a).valueOf() - dayjs(b).valueOf();
