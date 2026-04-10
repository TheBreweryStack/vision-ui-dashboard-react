/**
 * Timezone-aware time formatting utilities
 * Provides consistent time display with timezone indicators
 */

import { format } from 'date-fns';

/**
 * Common timezone abbreviations mapping
 * IANA timezone -> Abbreviation
 */
const TIMEZONE_ABBREVIATIONS: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HT',
  'America/Toronto': 'ET',
  'America/Vancouver': 'PT',
  'Europe/London': 'GMT',
  'Europe/Paris': 'CET',
  'Europe/Berlin': 'CET',
  'Asia/Tokyo': 'JST',
  'Asia/Shanghai': 'CST',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Singapore': 'SGT',
  'Australia/Sydney': 'AEST',
  'Australia/Melbourne': 'AEST',
  'UTC': 'UTC',
};

/**
 * Get short timezone abbreviation for a given IANA timezone
 * Falls back to generating one from the timezone string
 */
export function getTimezoneAbbreviation(timezone: string): string {
  // Check known abbreviations first
  if (TIMEZONE_ABBREVIATIONS[timezone]) {
    return TIMEZONE_ABBREVIATIONS[timezone];
  }

  // Try to get abbreviation from Intl API
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      return tzPart.value;
    }
  } catch {
    // Fallback: extract last part of timezone string
    const parts = timezone.split('/');
    return parts[parts.length - 1].slice(0, 3).toUpperCase();
  }

  return '';
}

/**
 * Format a time with optional timezone indicator
 * @param isoDate - ISO date string (e.g., "2026-01-30T14:30:00Z")
 * @param options - Formatting options
 * @returns Formatted time string like "2:30 PM ET"
 */
export function formatTimeWithTimezone(
  isoDate: string,
  options: {
    userTimezone?: string;
    showTimezone?: boolean;
    showDate?: boolean;
  } = {}
): string {
  const { userTimezone, showTimezone = true, showDate = false } = options;

  try {
    const date = new Date(isoDate);
    
    if (isNaN(date.getTime())) {
      return '';
    }

    // Format time - the browser will convert UTC to local automatically
    const timePart = format(date, 'h:mm a');
    
    // Optionally add date
    const datePart = showDate ? format(date, 'MMM d') + ' ' : '';

    // Add timezone abbreviation if requested
    if (showTimezone && userTimezone) {
      const tzAbbrev = getTimezoneAbbreviation(userTimezone);
      return `${datePart}${timePart} ${tzAbbrev}`;
    }

    return `${datePart}${timePart}`;
  } catch {
    return '';
  }
}

/**
 * Format just the time portion from an ISO date string
 * Uses browser's automatic UTC to local conversion
 */
export function formatLocalTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    return format(date, 'h:mm a');
  } catch {
    return '';
  }
}

/**
 * Format a date with timezone-aware time
 * @param isoDate - ISO date string
 * @param userTimezone - User's preferred timezone for display
 * @returns Formatted string like "Jan 30, 2:30 PM ET"
 */
export function formatDateTimeWithTimezone(
  isoDate: string,
  userTimezone?: string
): string {
  return formatTimeWithTimezone(isoDate, {
    userTimezone,
    showTimezone: !!userTimezone,
    showDate: true,
  });
}

/**
 * Get the current user's timezone from Intl API
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
