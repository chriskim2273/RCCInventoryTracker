import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a timestamp from Supabase into a Date object
 * Handles missing 'Z' suffix for UTC timestamps
 */
export function parseTimestamp(timestamp) {
  if (!timestamp) return null
  const utcTimestamp = timestamp.endsWith('Z') || timestamp.includes('+')
    ? timestamp
    : timestamp + 'Z'
  return new Date(utcTimestamp)
}

/**
 * Format a UTC timestamp from Supabase to local time string
 * Supabase returns timestamps in UTC but often without 'Z' suffix,
 * so JavaScript may misinterpret them as local time
 */
export function formatTimestamp(timestamp, options = {}) {
  const date = parseTimestamp(timestamp)
  if (!date) return '-'
  return date.toLocaleString('en-US', options)
}

/**
 * Format a UTC timestamp from Supabase to local date string (no time)
 */
export function formatDate(timestamp, options = {}) {
  const date = parseTimestamp(timestamp)
  if (!date) return 'Never'
  return date.toLocaleDateString('en-US', options)
}
