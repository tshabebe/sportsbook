import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const formatDuration = (totalMinutes: number): string => {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (minutes === 0) return hourLabel;
  return `${hourLabel} ${minutes} minute${minutes === 1 ? '' : 's'}`;
};

export const formatFixtureTime = (iso: string): string => {
  const local = dayjs(iso).tz(dayjs.tz.guess());
  if (!local.isValid()) return '';

  const now = dayjs().tz(dayjs.tz.guess());
  const diffMinutes = local.diff(now, 'minute');

  if (diffMinutes < 0) {
    return `Started ${local.from(now)}`;
  }

  if (diffMinutes <= 1) {
    return 'Starting now';
  }

  if (local.isSame(now, 'day')) {
    if (diffMinutes <= 360) {
      return `Starts in ${formatDuration(diffMinutes)}`;
    }
    return `Today ${local.format('HH:mm')}`;
  }

  if (local.isSame(now.add(1, 'day'), 'day')) {
    return `Tomorrow ${local.format('HH:mm')}`;
  }

  if (local.isBefore(now.add(7, 'day').endOf('day'))) {
    return `${local.format('ddd')} ${local.format('HH:mm')}`;
  }

  return `${local.format('DD MMM')} ${local.format('HH:mm')}`;
};

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
