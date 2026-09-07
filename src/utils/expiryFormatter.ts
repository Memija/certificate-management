/**
 * Utility functions for formatting certificate expiry and validity dates.
 * Converts raw day differences into human-readable years, months, and days
 * with complete multi-language localization.
 */

export interface ExpiryBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  isExpired: boolean;
}

/**
 * Calculates the calendar difference in years, months, days, and total days
 * between targetDate and a reference baseDate (defaults to now).
 */
export function getExpiryBreakdown(
  targetDate: string | Date | number,
  baseDate: Date = new Date()
): ExpiryBreakdown {
  const target = new Date(targetDate);
  if (isNaN(target.getTime())) {
    return { years: 0, months: 0, days: 0, totalDays: 0, isExpired: false };
  }

  const diffMs = target.getTime() - baseDate.getTime();
  const isExpired = diffMs < 0;
  const totalDays = Math.max(0, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));

  const earlier = isExpired ? target : baseDate;
  const later = isExpired ? baseDate : target;

  let years = later.getFullYear() - earlier.getFullYear();
  let months = later.getMonth() - earlier.getMonth();
  let days = later.getDate() - earlier.getDate();

  if (days < 0) {
    // Borrow days from the previous month
    const prevMonth = new Date(later.getFullYear(), later.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }

  if (months < 0) {
    months += 12;
    years--;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalDays,
    isExpired,
  };
}

/**
 * Formats a localized unit with proper pluralization (e.g. "2 years", "1 month", "15 days").
 */
function getLocalizedUnit(
  unit: 'year' | 'month' | 'day',
  count: number,
  t: (key: string, options?: any) => string,
  lang: string
): string {
  try {
    const pr = new Intl.PluralRules(lang || 'en');
    const rule = pr.select(count); // 'one' | 'few' | 'many' | 'other'
    const keyWithRule = `app.expiry.${unit}_${rule}`;
    const res = t(keyWithRule, { count, defaultValue: '' });
    if (res) return res;
  } catch {
    // fallback if Intl.PluralRules fails
  }

  // Fallback to _other or _one
  const fallbackKey = count === 1 ? `app.expiry.${unit}_one` : `app.expiry.${unit}_other`;
  const fallback = t(fallbackKey, { count, defaultValue: '' });
  if (fallback) return fallback;

  // Hard fallback to English if translations are completely missing
  if (count === 1) {
    return unit === 'year' ? '1 year' : unit === 'month' ? '1 month' : '1 day';
  }
  return unit === 'year' ? `${count} years` : unit === 'month' ? `${count} months` : `${count} days`;
}

export interface FormatExpiryOptions {
  baseDate?: Date;
  includePrefixSuffix?: boolean; // e.g. "in ..." or "... ago" (defaults to true)
}

/**
 * Formats the expiry duration of a target date into human-readable years, months, and days.
 * Examples:
 *  - "26 years, 8 months ago"
 *  - "2 years, 11 days ago"
 *  - "in 2 months, 15 days"
 *  - "in 18 days"
 *  - "today" / "expires today"
 */
export function formatExpiry(
  targetDate: string | Date | number,
  t: (key: string, options?: any) => string,
  lang: string = 'en',
  options?: FormatExpiryOptions
): string {
  const breakdown = getExpiryBreakdown(targetDate, options?.baseDate);
  const { years, months, days, totalDays, isExpired } = breakdown;

  if (totalDays === 0 && years === 0 && months === 0 && days === 0) {
    if (options?.includePrefixSuffix === false) {
      return t('app.expiry.today', 'today');
    }
    return isExpired
      ? t('app.expiry.expiredToday', 'expired today')
      : t('app.expiry.expiresToday', 'expires today');
  }

  const parts: string[] = [];

  if (years >= 1) {
    parts.push(getLocalizedUnit('year', years, t, lang));
    if (months > 0) {
      parts.push(getLocalizedUnit('month', months, t, lang));
    } else if (days > 0) {
      parts.push(getLocalizedUnit('day', days, t, lang));
    }
  } else if (months >= 1) {
    parts.push(getLocalizedUnit('month', months, t, lang));
    if (days > 0) {
      parts.push(getLocalizedUnit('day', days, t, lang));
    }
  } else {
    parts.push(getLocalizedUnit('day', Math.max(1, days), t, lang));
  }

  const durationStr = parts.join(', ');

  if (options?.includePrefixSuffix === false) {
    return durationStr;
  }

  if (isExpired) {
    return t('app.expiry.ago', { time: durationStr, defaultValue: `${durationStr} ago` });
  }
  return t('app.expiry.in', { time: durationStr, defaultValue: `in ${durationStr}` });
}

/**
 * Generates an informative tooltip text for hover, displaying total days along with full breakdown and date.
 * Example: "741 days ago (2 years, 11 days) • Expired on 8/25/2024"
 */
export function formatExpiryTooltip(
  targetDate: string | Date | number,
  t: (key: string, options?: any) => string,
  lang: string = 'en',
  baseDate: Date = new Date()
): string {
  const d = new Date(targetDate);
  if (isNaN(d.getTime())) return '';

  const breakdown = getExpiryBreakdown(targetDate, baseDate);
  const formattedRelative = formatExpiry(targetDate, t, lang, { baseDate });
  const dateFormatted = d.toLocaleDateString();

  const daysLabel = breakdown.isExpired
    ? t('app.expiry.tooltipDaysAgo', { days: breakdown.totalDays, defaultValue: `${breakdown.totalDays} days ago` })
    : t('app.expiry.tooltipDaysIn', { days: breakdown.totalDays, defaultValue: `in ${breakdown.totalDays} days` });

  return `${daysLabel} (${formattedRelative}) • ${dateFormatted}`;
}
