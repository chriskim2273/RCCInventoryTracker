import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronLeft, MapPin, Building2, DoorOpen, Package, ChevronDown, X, Search, Check } from 'lucide-react'

/**
 * Hierarchical Location Picker
 * A drill-down interface for selecting deeply nested locations
 * Mobile-optimized with full path visibility
 */
export default function LocationPicker({
  locations,
  value,
  onChange,
  required = false,
  placeholder = "Select location..."
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [navigationPath, setNavigationPath] = useState([]) // Stack of parent IDs for breadcrumb
  const [searchQuery, setSearchQuery] = useState('')
  const [showFullPath, setShowFullPath] = useState(false) // For mobile path expansion
  const [breadcrumbScrollable, setBreadcrumbScrollable] = useState({ left: false, right: false })
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const breadcrumbRef = useRef(null)

  // Build location tree structure
  const buildTree = (locs) => {
    const map = {}
    const roots = []

    locs.forEach(loc => {
      map[loc.id] = { ...loc, children: [] }
    })

    locs.forEach(loc => {
      if (loc.parent_id && map[loc.parent_id]) {
        map[loc.parent_id].children.push(map[loc.id])
      } else if (!loc.parent_id) {
        roots.push(map[loc.id])
      }
    })

    return { roots, map }
  }

  const { roots, map } = buildTree(locations)

  // Get selected location details
  const selectedLocation = value ? map[value] : null

  // Get current level locations based on navigation path
  const getCurrentLocations = () => {
    if (navigationPath.length === 0) {
      return roots
    }
    const currentParentId = navigationPath[navigationPath.length - 1]
    return map[currentParentId]?.children || []
  }

  // Filter locations by search query (searches all locations)
  const getFilteredLocations = () => {
    if (!searchQuery.trim()) return null

    const query = searchQuery.toLowerCase()
    return locations.filter(loc =>
      loc.name.toLowerCase().includes(query) ||
      loc.path.toLowerCase().includes(query)
    )
  }

  const filteredLocations = getFilteredLocations()
  const currentLocations = filteredLocations || getCurrentLocations()

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
        setNavigationPath([])
        setShowFullPath(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check breadcrumb scroll state
  const updateBreadcrumbScroll = () => {
    if (breadcrumbRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = breadcrumbRef.current
      setBreadcrumbScrollable({
        left: scrollLeft > 0,
        right: scrollLeft < scrollWidth - clientWidth - 1
      })
    }
  }

  useEffect(() => {
    updateBreadcrumbScroll()
  }, [navigationPath, isOpen])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (location) => {
    onChange(location.id)
    setIsOpen(false)
    setSearchQuery('')
    setNavigationPath([])
    setShowFullPath(false)
  }

  const handleDrillDown = (location) => {
    if (location.children && location.children.length > 0) {
      setNavigationPath([...navigationPath, location.id])
      setSearchQuery('')
    }
  }

  const handleBreadcrumbClick = (index) => {
    if (index === -1) {
      setNavigationPath([])
    } else {
      setNavigationPath(navigationPath.slice(0, index + 1))
    }
    setSearchQuery('')
  }

  const getLocationIcon = (location, isRoot = false) => {
    const depth = location.path?.split(' / ').length || 1

    if (depth === 1 || isRoot) {
      return <Building2 className="h-4 w-4 text-primary/70" />
    } else if (depth === 2) {
      return <DoorOpen className="h-4 w-4 text-accent/80" />
    } else {
      return <Package className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getBreadcrumbItems = () => {
    const items = [{ id: null, name: 'All', index: -1 }]
    navigationPath.forEach((id, index) => {
      const loc = map[id]
      if (loc) {
        items.push({ id, name: loc.name, index })
      }
    })
    return items
  }

  // Scroll breadcrumbs
  const scrollBreadcrumbs = (direction) => {
    if (breadcrumbRef.current) {
      const scrollAmount = 120
      breadcrumbRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(updateBreadcrumbScroll, 150)
    }
  }

  // Get path segments for hierarchical display
  const getPathSegments = (path) => {
    if (!path) return []
    return path.split(' / ')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <div
        className={`
          w-full border rounded-md bg-background
          transition-all duration-150
          ${isOpen ? 'ring-2 ring-primary/30 border-primary' : 'hover:border-primary/50'}
        `}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-3 py-2.5 sm:py-2 text-left
            flex items-center justify-between gap-2
            min-h-[44px] sm:min-h-0
            ${!selectedLocation && 'text-muted-foreground'}
          `}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            {selectedLocation ? (
              <div className="min-w-0 flex-1">
                {/* Mobile: Show hierarchical path if expanded, otherwise truncate with indicator */}
                {showFullPath ? (
                  <div className="text-sm space-y-0.5">
                    {(() => {
                      const segments = getPathSegments(selectedLocation.path)
                      return segments.map((segment, idx) => (
                        <div key={idx} className="flex items-center gap-1" style={{ paddingLeft: `${idx * 12}px` }}>
                          {idx > 0 && <span className="text-muted-foreground">└</span>}
                          <span className={idx === segments.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
                            {segment}
                          </span>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <span className="block truncate text-sm sm:text-base">
                    {selectedLocation.path}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm sm:text-base">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Expand/Collapse path button - only show when selected and path is long */}
        {selectedLocation && selectedLocation.path && selectedLocation.path.length > 30 && !isOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowFullPath(!showFullPath)
            }}
            className="w-full px-3 py-1.5 text-xs text-primary hover:text-primary/80 border-t flex items-center justify-center gap-1 min-h-[32px] sm:min-h-0"
          >
            {showFullPath ? 'Hide full path' : 'Show full path'}
            <ChevronDown className={`h-3 w-3 transition-transform ${showFullPath ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value || ''}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header with selected location preview and close */}
          <div className="p-2.5 sm:p-2 border-b bg-muted/30 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search locations..."
                  className="w-full pl-8 pr-10 py-2.5 sm:py-1.5 text-base sm:text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted min-w-[32px] min-h-[32px] flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Location Preview - shows full path when a location is selected */}
          {selectedLocation && (
            <div className="px-3 py-2 border-b bg-primary/5 flex items-start gap-2">
              <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-0.5">Selected:</div>
                <div className="text-sm text-primary font-medium break-words">
                  {selectedLocation.path}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                className="flex-shrink-0 p-1.5 text-destructive hover:bg-destructive/10 rounded-md min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Breadcrumb Navigation with scroll indicators */}
          {!filteredLocations && navigationPath.length > 0 && (
            <div className="relative border-b bg-muted/20">
              {/* Left scroll indicator */}
              {breadcrumbScrollable.left && (
                <button
                  type="button"
                  onClick={() => scrollBreadcrumbs('left')}
                  className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/80 to-transparent z-10 flex items-center justify-start pl-1"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              {/* Breadcrumb items */}
              <div
                ref={breadcrumbRef}
                onScroll={updateBreadcrumbScroll}
                className="px-2 py-2 flex items-center gap-1 text-sm overflow-x-auto scrollbar-hide"
              >
                {getBreadcrumbItems().map((item, idx) => (
                  <div key={item.id || 'root'} className="flex items-center gap-1 flex-shrink-0">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(item.index)}
                      className={`
                        px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-md transition-colors
                        min-h-[36px] sm:min-h-0
                        ${idx === getBreadcrumbItems().length - 1
                          ? 'text-primary font-medium bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
                      `}
                    >
                      {item.name}
                    </button>
                  </div>
                ))}
              </div>

              {/* Right scroll indicator */}
              {breadcrumbScrollable.right && (
                <button
                  type="button"
                  onClick={() => scrollBreadcrumbs('right')}
                  className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/80 to-transparent z-10 flex items-center justify-end pr-1"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Location List - responsive height */}
          <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto">
            {currentLocations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No locations found' : 'No sub-locations'}
              </div>
            ) : (
              <div className="py-1">
                {currentLocations.map((location) => {
                  const hasChildren = location.children && location.children.length > 0
                  const isSelected = value === location.id

                  return (
                    <div
                      key={location.id}
                      className={`
                        group flex items-center gap-2 px-3 py-3 sm:py-2 cursor-pointer
                        transition-colors duration-100
                        ${isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50 active:bg-muted'}
                      `}
                    >
                      {/* Select this location */}
                      <button
                        type="button"
                        onClick={() => handleSelect(location)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left min-h-[44px] sm:min-h-0"
                      >
                        {getLocationIcon(location, navigationPath.length === 0 && !filteredLocations)}
                        <div className="min-w-0 flex-1">
                          {/* Show full path with wrapping when searching, otherwise show name */}
                          {filteredLocations ? (
                            <div className={`text-sm leading-relaxed break-words ${isSelected ? 'font-medium' : ''}`}>
                              {location.path}
                            </div>
                          ) : (
                            <>
                              <div className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                                {location.name}
                              </div>
                              {hasChildren && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {location.children.length} sub-location{location.children.length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                        )}
                      </button>

                      {/* Drill-down button - larger touch target on mobile */}
                      {hasChildren && !filteredLocations && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDrillDown(location)
                          }}
                          className="
                            flex-shrink-0 p-2.5 sm:p-1.5 -mr-1 rounded-md
                            text-muted-foreground
                            hover:text-primary hover:bg-primary/10
                            active:bg-primary/20
                            transition-colors
                            min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
                            flex items-center justify-center
                          "
                          title={`Browse ${location.name}`}
                        >
                          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer - mobile optimized */}
          <div className="px-3 py-2.5 sm:py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span className="hidden sm:inline">Tap to select, arrow to browse deeper</span>
            <span className="sm:hidden">Tap to select</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setSearchQuery('')
                setNavigationPath([])
                setShowFullPath(false)
              }}
              className="text-primary font-medium px-3 py-1.5 sm:py-1 rounded-md hover:bg-primary/10 min-h-[32px] sm:min-h-0 flex items-center"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
