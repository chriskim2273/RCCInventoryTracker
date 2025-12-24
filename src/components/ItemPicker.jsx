import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, Package, Check, Sparkles, ChevronRight, Tag, MapPin } from 'lucide-react'
import Fuse from 'fuse.js'

/**
 * ItemPicker - A sophisticated command-palette style item selector
 *
 * Design: Refined spotlight search with glass morphism,
 * staggered animations, and keyboard navigation
 *
 * Mobile-optimized with full-screen mode, larger touch targets,
 * and responsive layouts
 */
export default function ItemPicker({
  items = [],
  categories = [],
  locations = [],
  selectedItemId,
  onSelect,
  onClose,
  isOpen,
  disabled = false,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const searchInputRef = useRef(null)
  const listRef = useRef(null)
  const itemRefs = useRef([])

  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = {}
    categories.forEach(cat => {
      map[cat.id] = cat
    })
    return map
  }, [categories])

  // Build location lookup map
  const locationMap = useMemo(() => {
    const map = {}
    locations.forEach(loc => {
      map[loc.id] = loc
    })
    return map
  }, [locations])

  // Build location path map
  const locationPathMap = useMemo(() => {
    const pathMap = {}

    // Helper to get path for a single location
    const getPath = (locId) => {
      if (!locId || !locationMap[locId]) return ''

      const parts = []
      let current = locationMap[locId]

      while (current) {
        parts.unshift(current.name)
        current = current.parent_id ? locationMap[current.parent_id] : null
      }

      return parts.join(' > ')
    }

    locations.forEach(loc => {
      pathMap[loc.id] = getPath(loc.id)
    })

    return pathMap
  }, [locations, locationMap])

  // Fuse.js configuration for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'brand', weight: 2 },
        { name: 'model', weight: 1.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 1,
      includeScore: true,
    })
  }, [items])

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let results = items

    // Apply fuzzy search
    if (searchQuery.trim()) {
      const fuseResults = fuse.search(searchQuery)
      results = fuseResults.map(r => r.item)
    }

    // Apply category filter
    if (selectedCategory) {
      results = results.filter(item => item.category_id === selectedCategory)
    }

    return results.slice(0, 50) // Limit for performance
  }, [items, searchQuery, fuse, selectedCategory])

  // Get unique categories from items
  const availableCategories = useMemo(() => {
    const catIds = new Set(items.map(item => item.category_id).filter(Boolean))
    return categories.filter(cat => catIds.has(cat.id))
  }, [items, categories])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure animation starts first
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
      setSearchQuery('')
      setHighlightedIndex(0)
      setSelectedCategory(null)

      // Prevent body scroll on mobile
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [highlightedIndex])

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchQuery, selectedCategory])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredItems[highlightedIndex]) {
          onSelect(filteredItems[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [isOpen, filteredItems, highlightedIndex, onSelect, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-4 sm:pt-[8vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 sm:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Command Palette - Full height on mobile, constrained on desktop */}
      <div className="relative w-full h-[calc(100%-2rem)] sm:h-auto max-w-2xl mx-2 sm:mx-4 animate-slide-up flex flex-col">
        {/* Glass container */}
        <div className="bg-white dark:bg-zinc-950 sm:bg-white/95 sm:dark:bg-zinc-950/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-full sm:h-auto">

          {/* Search header */}
          <div className="relative border-b border-border/50 flex-shrink-0">
            {/* Mobile close bar */}
            <div className="flex items-center justify-between px-4 py-3 sm:hidden border-b border-border/30">
              <span className="text-sm font-medium text-muted-foreground">Select Item</span>
              <button
                onClick={onClose}
                className="p-2 -mr-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex items-center px-4 sm:px-5 py-3 sm:py-4">
              <Search className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="flex-1 bg-transparent text-base sm:text-lg outline-none placeholder:text-muted-foreground/60 font-medium tracking-tight"
                disabled={disabled}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {/* Desktop ESC hint */}
              <button
                onClick={onClose}
                className="hidden sm:block ml-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/80 hover:bg-muted rounded-lg transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Category filter chips - horizontally scrollable */}
            {availableCategories.length > 0 && (
              <div className="px-4 sm:px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${!selectedCategory
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted active:scale-95'
                    }`}
                >
                  <Sparkles className="h-3 w-3" />
                  All
                </button>
                {availableCategories.map((cat, idx) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'bg-muted/80 text-muted-foreground hover:bg-muted active:scale-95'
                      }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results list - flexible height */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-contain min-h-0 sm:max-h-[50vh]"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 sm:py-16 text-center px-4">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-muted/50 mb-4">
                  <Package className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No items found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              <div className="py-1 sm:py-2">
                {filteredItems.map((item, index) => {
                  const category = categoryMap[item.category_id]
                  const locationPath = locationPathMap[item.location_id]
                  const isHighlighted = index === highlightedIndex
                  const isSelected = item.id === selectedItemId

                  return (
                    <button
                      key={item.id}
                      ref={el => itemRefs.current[index] = el}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full px-4 sm:px-5 py-3.5 sm:py-3.5 flex items-center gap-3 sm:gap-4 text-left transition-all duration-150 group active:bg-primary/15 ${isHighlighted
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                        } ${isSelected ? 'bg-primary/5' : ''}`}
                      style={{
                        animationDelay: `${Math.min(index * 20, 200)}ms`,
                      }}
                    >
                      {/* Item icon/avatar */}
                      <div className={`flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${isHighlighted
                        ? 'bg-primary/20 scale-105'
                        : 'bg-muted/80 group-hover:bg-muted'
                        }`}>
                        {category?.icon ? (
                          <span className="text-lg sm:text-xl">{category.icon}</span>
                        ) : (
                          <Package className={`h-5 w-5 ${isHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />
                        )}
                      </div>

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold truncate text-sm sm:text-base ${isHighlighted ? 'text-primary' : ''}`}>
                            {item.name}
                          </span>
                          {isSelected && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-primary/20 text-primary text-[10px] sm:text-xs font-medium rounded-full">
                              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">Selected</span>
                            </span>
                          )}
                        </div>
                        {(item.brand || item.model) && (
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                            {item.brand && (
                              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                {item.brand}
                              </span>
                            )}
                            {item.brand && item.model && (
                              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
                            )}
                            {item.model && (
                              <span className="text-xs sm:text-sm text-muted-foreground/70 truncate hidden sm:inline">
                                {item.model}
                              </span>
                            )}
                          </div>
                        )}
                        {category && (
                          <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5">
                            <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground/50" />
                            <span className="text-[10px] sm:text-xs text-muted-foreground/70">
                              {category.name}
                            </span>
                          </div>
                        )}
                        {locationPath && (
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground/50 flex-shrink-0" />
                            <span className="text-[10px] sm:text-xs text-muted-foreground/70 truncate">
                              {locationPath}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Arrow indicator - hidden on mobile */}
                      <ChevronRight className={`hidden sm:block flex-shrink-0 h-5 w-5 transition-all duration-200 ${isHighlighted
                        ? 'text-primary opacity-100 translate-x-0'
                        : 'text-muted-foreground/30 opacity-0 -translate-x-2'
                        }`} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer - keyboard hints on desktop, count on mobile */}
          <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-border/50 bg-muted/30 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {/* Desktop keyboard hints */}
              <div className="hidden sm:flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">↓</kbd>
                  <span className="ml-1">Navigate</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">↵</kbd>
                  <span className="ml-1">Select</span>
                </span>
              </div>
              {/* Mobile: tap to select hint */}
              <span className="sm:hidden text-muted-foreground/70">
                Tap to select
              </span>
              <span className="text-muted-foreground/70">
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ItemPickerTrigger - The button that opens the item picker
 */
export function ItemPickerTrigger({
  selectedItem,
  category,
  onClick,
  disabled = false,
  placeholder = "Select an item...",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left group transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        }`}
    >
      <div className={`relative flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3 border rounded-xl transition-all duration-200 ${selectedItem
        ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
        : 'border-border hover:border-primary/30 hover:bg-muted/30'
        } ${disabled ? '' : 'group-hover:shadow-lg group-hover:shadow-primary/5 active:scale-[0.99]'}`}>

        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-all duration-200 ${selectedItem
          ? 'bg-primary/10'
          : 'bg-muted group-hover:bg-primary/10'
          }`}>
          {selectedItem && category?.icon ? (
            <span className="text-base sm:text-lg">{category.icon}</span>
          ) : (
            <Package className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-200 ${selectedItem ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
              }`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {selectedItem ? (
            <>
              <div className="font-semibold text-foreground truncate text-sm sm:text-base">
                {selectedItem.name}
              </div>
              {(selectedItem.brand || selectedItem.model) && (
                <div className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                  {selectedItem.brand}
                  {selectedItem.brand && selectedItem.model && ' · '}
                  {selectedItem.model}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm sm:text-base">
              {placeholder}
            </div>
          )}
        </div>

        {/* Search hint */}
        <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg transition-all duration-200 ${selectedItem
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          }`}>
          <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Search</span>
        </div>
      </div>
    </button>
  )
}
