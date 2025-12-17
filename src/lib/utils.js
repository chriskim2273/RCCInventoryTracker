import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format a UTC timestamp from Supabase to local time string
 * Supabase returns timestamps in UTC but often without 'Z' suffix,
 * so JavaScript may misinterpret them as local time
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '-'
  // Append 'Z' to ensure JavaScript parses it as UTC
  const utcTimestamp = timestamp.endsWith('Z') || timestamp.includes('+')
    ? timestamp
    : timestamp + 'Z'
  return new Date(utcTimestamp).toLocaleString()
}

/**
 * Format a UTC timestamp from Supabase to local date string (no time)
 */
export function formatDate(timestamp) {
  if (!timestamp) return 'Never'
  const utcTimestamp = timestamp.endsWith('Z') || timestamp.includes('+')
    ? timestamp
    : timestamp + 'Z'
  return new Date(utcTimestamp).toLocaleDateString()
}
