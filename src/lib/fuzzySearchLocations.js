import Fuse from 'fuse.js'

/**
 * Fuse.js configuration for location search
 * - keys: fields to search with relative weights
 * - threshold: 0 = exact, 1 = match anything (0.35 is balanced for location names)
 * - ignoreLocation: match anywhere in the string, not just at start
 * - includeMatches: provides match indices for highlighting
 */
const LOCATION_FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 3 },        // Location name is highest priority
    { name: 'path', weight: 2 },        // Full path for context matching
    { name: 'description', weight: 1 }, // Description for additional context
  ],
  threshold: 0.35,          // Slightly more tolerant for location names
  ignoreLocation: true,     // Match anywhere in string
  includeScore: true,
  includeMatches: true,     // For highlighting matched text
  minMatchCharLength: 2,
  findAllMatches: true,
}

/**
 * Fuzzy search locations using Fuse.js
 * Returns locations sorted by relevance with match highlighting info
 *
 * @param {Array} locations - Array of location objects to search
 * @param {string} query - Search query string
 * @returns {Array} - Filtered locations sorted by relevance with score and matches
 */
export function fuzzySearchLocations(locations, query) {
  if (!query?.trim()) {
    return []
  }

  if (!locations || locations.length === 0) {
    return []
  }

  const fuse = new Fuse(locations, LOCATION_FUSE_OPTIONS)
  const results = fuse.search(query.trim())

  return results.map((result) => ({
    ...result.item,
    _score: result.score,
    _matches: result.matches,
  }))
}

/**
 * Calculate the depth of a location in the hierarchy
 *
 * @param {Object} location - Location object with parent_id
 * @param {Array} allLocations - All locations for traversal
 * @returns {number} - Depth level (0 = root)
 */
export function getLocationDepth(location, allLocations) {
  let depth = 0
  let current = location

  while (current?.parent_id) {
    depth++
    current = allLocations.find((l) => l.id === current.parent_id)
    // Prevent infinite loops
    if (depth > 20) break
  }

  return depth
}

/**
 * Get parent chain for a location (for breadcrumb display)
 *
 * @param {Object} location - Location object
 * @param {Array} allLocations - All locations for traversal
 * @returns {Array} - Array of parent locations from root to immediate parent
 */
export function getLocationParentChain(location, allLocations) {
  const chain = []
  let current = location

  while (current?.parent_id) {
    const parent = allLocations.find((l) => l.id === current.parent_id)
    if (parent) {
      chain.unshift(parent)
      current = parent
    } else {
      break
    }
    // Prevent infinite loops
    if (chain.length > 20) break
  }

  return chain
}
