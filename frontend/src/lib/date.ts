import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const formatFixtureTime = (iso: string): string =>
  dayjs(iso).tz(dayjs.tz.guess()).format('HH:mm');

export const formatFixtureDate = (iso: string): string =>
  dayjs(iso).tz(dayjs.tz.guess()).format('DD MMM');

export const isPastIso = (iso: string): boolean => dayjs(iso).isBefore(dayjs());

export const compareIsoAsc = (a: string, b: string): number =>
  dayjs(a).valueOf() - dayjs(b).valueOf();

export const formatKickoffRelative = (iso: string): string => {
  const target = dayjs(iso);
  const now = dayjs();
  if (target.isBefore(now)) return target.fromNow();
  return `in ${target.fromNow(true)}`;
};
