import Fuse from 'fuse.js'

/**
 * Fuse.js configuration for item search
 * - keys: fields to search with relative weights
 * - threshold: 0 = exact, 1 = match anything (0.35 is balanced)
 * - ignoreLocation: match anywhere in the string, not just at start
 * - includeMatches: provides match indices for highlighting
 */
const ITEM_FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 3 },           // Item name is highest priority
    { name: 'serial_number', weight: 2 },  // Serial number for exact lookups
    { name: 'category.name', weight: 1.5 }, // Category for filtering by type
    { name: 'location.name', weight: 1 },  // Sublocation name
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,  // More responsive for quick typing
  findAllMatches: true,
}

/**
 * Fuzzy search items using Fuse.js
 * Returns items sorted by relevance with match highlighting info
 *
 * @param {Array} items - Array of item objects to search
 * @param {string} query - Search query string
 * @returns {Array} - Filtered items sorted by relevance with matches
 */
export function fuzzySearchItems(items, query) {
  if (!query?.trim()) {
    return items || []
  }

  if (!items || items.length === 0) {
    return []
  }

  const fuse = new Fuse(items, ITEM_FUSE_OPTIONS)
  const results = fuse.search(query.trim())

  return results.map((result) => ({
    ...result.item,
    _score: result.score,
    _matches: result.matches,
  }))
}
