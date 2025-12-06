import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MapPin, Building2, DoorOpen, Package, ChevronDown, X, Search } from 'lucide-react'

/**
 * Hierarchical Location Picker
 * A drill-down interface for selecting deeply nested locations
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
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

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
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    const items = [{ id: null, name: 'All Buildings', index: -1 }]
    navigationPath.forEach((id, index) => {
      const loc = map[id]
      if (loc) {
        items.push({ id, name: loc.name, index })
      }
    })
    return items
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 py-2 border rounded-md bg-background text-left
          flex items-center justify-between gap-2
          transition-all duration-150
          ${isOpen ? 'ring-2 ring-primary/30 border-primary' : 'hover:border-primary/50'}
          ${!selectedLocation && 'text-muted-foreground'}
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedLocation ? selectedLocation.path : placeholder}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

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
          {/* Search Bar */}
          <div className="p-2 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search locations..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Breadcrumb Navigation */}
          {!filteredLocations && navigationPath.length > 0 && (
            <div className="px-2 py-1.5 border-b bg-muted/20 flex items-center gap-1 text-xs overflow-x-auto scrollbar-hide">
              {getBreadcrumbItems().map((item, idx) => (
                <div key={item.id || 'root'} className="flex items-center gap-1 flex-shrink-0">
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(item.index)}
                    className={`
                      px-1.5 py-0.5 rounded transition-colors
                      ${idx === getBreadcrumbItems().length - 1
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
                    `}
                  >
                    {item.name}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Location List */}
          <div className="max-h-64 overflow-y-auto">
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
                        group flex items-center gap-2 px-3 py-2 cursor-pointer
                        transition-colors duration-100
                        ${isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50'}
                      `}
                    >
                      {/* Select this location */}
                      <button
                        type="button"
                        onClick={() => handleSelect(location)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        {getLocationIcon(location, navigationPath.length === 0 && !filteredLocations)}
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm ${isSelected ? 'font-medium' : ''}`}>
                            {filteredLocations ? location.path : location.name}
                          </div>
                          {!filteredLocations && hasChildren && (
                            <div className="text-xs text-muted-foreground">
                              {location.children.length} sub-location{location.children.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>

                      {/* Drill-down button */}
                      {hasChildren && !filteredLocations && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDrillDown(location)
                          }}
                          className="
                            flex-shrink-0 p-1.5 rounded-md
                            text-muted-foreground
                            hover:text-primary hover:bg-primary/10
                            transition-colors
                          "
                          title={`Browse ${location.name}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
            <span>Click to select, arrow to browse deeper</span>
            {selectedLocation && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className="text-destructive hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
