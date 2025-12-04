import Fuse from 'fuse.js'

/**
 * Fuse.js configuration for item search
 * - keys: fields to search with relative weights
 * - threshold: 0 = exact, 1 = match anything (0.4 is balanced for typo tolerance)
 * - ignoreLocation: match anywhere in the string, not just at start
 * - minMatchCharLength: ignore single-character matches to reduce noise
 */
const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'description', weight: 1.5 },
    { name: 'brand', weight: 1 },
    { name: 'model', weight: 1 },
    { name: 'serial_number', weight: 0.8 },
    { name: 'stony_brook_asset_tag', weight: 0.5 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  findAllMatches: true,
}

/**
 * Fuzzy search items using Fuse.js
 * Searches across name, description, brand, model, serial_number, and asset tag
 * with configurable weights and typo tolerance.
 *
 * @param {Array} items - Array of item objects to search
 * @param {string} query - Search query string
 * @returns {Array} - Filtered items sorted by relevance (best matches first)
 */
export function fuzzySearchItems(items, query) {
  if (!query?.trim()) {
    return items
  }

  if (!items || items.length === 0) {
    return []
  }

  const fuse = new Fuse(items, FUSE_OPTIONS)
  const results = fuse.search(query.trim())

  // Return items sorted by relevance (Fuse already sorts by score)
  return results.map((result) => result.item)
}
