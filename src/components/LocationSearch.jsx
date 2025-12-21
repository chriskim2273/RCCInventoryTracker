import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, MapPin, Folder, ChevronRight, Clock, CornerDownLeft } from 'lucide-react'
import { fuzzySearchLocations, getLocationDepth, getLocationParentChain } from '@/lib/fuzzySearchLocations'

const RECENT_SEARCHES_KEY = 'locationSearchRecent'
const MAX_RECENT_SEARCHES = 5
const MAX_RESULTS = 8
const DEBOUNCE_MS = 150

/**
 * Get recent searches from localStorage
 */
function getRecentSearches() {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Save a location to recent searches
 */
function saveRecentSearch(location) {
  try {
    const recent = getRecentSearches()
    // Remove if already exists, then add to front
    const filtered = recent.filter((r) => r.id !== location.id)
    const updated = [
      { id: location.id, name: location.name, path: location.path },
      ...filtered,
    ].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Highlight matched text in a string
 */
function HighlightedText({ text, matches, fieldName }) {
  if (!matches || !text) {
    return <span>{text}</span>
  }

  const fieldMatch = matches.find((m) => m.key === fieldName)
  if (!fieldMatch || !fieldMatch.indices?.length) {
    return <span>{text}</span>
  }

  // Sort indices and merge overlapping
  const indices = [...fieldMatch.indices].sort((a, b) => a[0] - b[0])
  const parts = []
  let lastEnd = 0

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      parts.push({ text: text.slice(lastEnd, start), highlight: false })
    }
    parts.push({ text: text.slice(start, end + 1), highlight: true })
    lastEnd = end + 1
  }

  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), highlight: false })
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-foreground rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  )
}

/**
 * Single search result item
 */
const SearchResultItem = memo(function SearchResultItem({
  location,
  allLocations,
  isSelected,
  index,
  onClick,
  onMouseEnter,
}) {
  const depth = getLocationDepth(location, allLocations)
  const hasChildren = allLocations.some((l) => l.parent_id === location.id)
  const parentChain = getLocationParentChain(location, allLocations)

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        search-result-item animate-search-result opacity-0
        w-full text-left px-4 py-3 flex items-start gap-3
        transition-colors duration-100
        ${isSelected
          ? 'bg-primary/10 dark:bg-primary/20'
          : 'hover:bg-muted/50'
        }
        focus:outline-none focus:bg-primary/10
      `}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Icon with depth indicator */}
      <div className="flex-shrink-0 mt-0.5 relative">
        {hasChildren ? (
          <Folder className="h-5 w-5 text-primary" />
        ) : (
          <MapPin className="h-5 w-5 text-muted-foreground" />
        )}
        {depth > 0 && (
          <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-3.5 h-3.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-full">
            {depth}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          <HighlightedText
            text={location.name}
            matches={location._matches}
            fieldName="name"
          />
        </div>

        {/* Breadcrumb path */}
        {parentChain.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground overflow-hidden">
            {parentChain.map((parent, i) => (
              <span key={parent.id} className="flex items-center gap-1 flex-shrink-0">
                {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                <span className="truncate max-w-[100px]">{parent.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Description if available */}
        {location.description && (
          <div className="text-xs text-muted-foreground mt-1 truncate">
            <HighlightedText
              text={location.description}
              matches={location._matches}
              fieldName="description"
            />
          </div>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="flex-shrink-0 self-center">
          <CornerDownLeft className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </button>
  )
})

/**
 * Recent search item
 */
function RecentSearchItem({ location, isSelected, index, onClick, onMouseEnter }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        search-result-item animate-search-result opacity-0
        w-full text-left px-4 py-2.5 flex items-center gap-3
        transition-colors duration-100
        ${isSelected
          ? 'bg-primary/10 dark:bg-primary/20'
          : 'hover:bg-muted/50'
        }
        focus:outline-none
      `}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{location.name}</div>
        {location.path && (
          <div className="text-xs text-muted-foreground truncate">{location.path}</div>
        )}
      </div>
      {isSelected && (
        <CornerDownLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  )
}

/**
 * Location Search Command Palette
 */
const LocationSearch = memo(function LocationSearch({ isOpen, onClose, locations }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState([])
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const navigate = useNavigate()

  // Load recent searches on mount
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches())
    }
  }, [isOpen])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow close animation
      const timer = setTimeout(() => {
        setQuery('')
        setResults([])
        setSelectedIndex(0)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSelectedIndex(0)
      return
    }

    const timer = setTimeout(() => {
      const searchResults = fuzzySearchLocations(locations, query)
      setResults(searchResults.slice(0, MAX_RESULTS))
      setSelectedIndex(0)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, locations])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      )
      selectedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Get current list to display (results or recent searches)
  const displayList = query.trim() ? results : recentSearches
  const isShowingRecent = !query.trim() && recentSearches.length > 0

  const handleSelectLocation = useCallback(
    (location) => {
      saveRecentSearch(location)
      onClose()
      navigate(`/locations/${location.id}`)
    },
    [navigate, onClose]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, displayList.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (displayList[selectedIndex]) {
            handleSelectLocation(displayList[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            setSelectedIndex((i) => Math.max(i - 1, 0))
          } else {
            setSelectedIndex((i) => Math.min(i + 1, displayList.length - 1))
          }
          break
      }
    },
    [displayList, selectedIndex, onClose, handleSelectLocation]
  )

  // Global Escape key listener (works regardless of focus)
  useEffect(() => {
    if (!isOpen) return

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 animate-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search locations"
    >
      {/* Backdrop - clickable to close */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="relative flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
        <div
          className="
            animate-search-panel
            w-full max-w-xl
            bg-card border border-border
            rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50
            overflow-hidden
          "
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="relative border-b border-border">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locations..."
              className="
                w-full py-4 pl-12 pr-12
                text-base bg-transparent
                placeholder:text-muted-foreground
                focus:outline-none
              "
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className="max-h-[50vh] overflow-y-auto overscroll-contain"
          >
            {/* Section Header */}
            {displayList.length > 0 && (
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                {isShowingRecent ? 'Recent' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
              </div>
            )}

            {/* Result Items */}
            {displayList.length > 0 ? (
              <div className="py-1">
                {displayList.map((location, index) =>
                  isShowingRecent ? (
                    <RecentSearchItem
                      key={location.id}
                      location={location}
                      isSelected={index === selectedIndex}
                      index={index}
                      onClick={() => handleSelectLocation(location)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    />
                  ) : (
                    <SearchResultItem
                      key={location.id}
                      location={location}
                      allLocations={locations}
                      isSelected={index === selectedIndex}
                      index={index}
                      onClick={() => handleSelectLocation(location)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    />
                  )
                )}
              </div>
            ) : query.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No locations found for "{query}"</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Start typing to search locations</p>
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↓</kbd>
                <span className="ml-1">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
                <span className="ml-1">Select</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
              <span className="ml-1">Close</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default LocationSearch
