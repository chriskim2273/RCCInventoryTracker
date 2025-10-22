import { useState } from 'react'
import { ChevronRight, ChevronDown, MapPin, Folder } from 'lucide-react'
import { Link } from 'react-router-dom'

function TreeNode({ location, allLocations, onLocationClick, level = 0 }) {
  const [isExpanded, setIsExpanded] = useState(level === 0)

  const children = allLocations.filter(loc => loc.parent_id === location.id)
  const hasChildren = children.length > 0

  const handleToggle = (e) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors ${
          level === 0 ? '' : 'ml-4'
        }`}
        onClick={() => onLocationClick && onLocationClick(location)}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex-shrink-0 hover:bg-secondary rounded p-0.5 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {hasChildren ? (
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}

        <Link
          to={`/locations/${location.id}`}
          className="flex-1 text-sm hover:text-primary transition-colors truncate"
          title={location.path}
        >
          {location.name}
        </Link>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-2">
          {children.map(child => (
            <TreeNode
              key={child.id}
              location={child}
              allLocations={allLocations}
              onLocationClick={onLocationClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TreeView({ locations, onLocationClick, className = '' }) {
  if (!locations || locations.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        No locations found
      </div>
    )
  }

  const rootLocations = locations.filter(loc => !loc.parent_id)

  if (rootLocations.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        No root locations found
      </div>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {rootLocations.map(location => (
        <TreeNode
          key={location.id}
          location={location}
          allLocations={locations}
          onLocationClick={onLocationClick}
          level={0}
        />
      ))}
    </div>
  )
}
