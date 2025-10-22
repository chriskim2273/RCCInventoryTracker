import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Home, Plus, Minus, Edit, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import ItemModal from '@/components/ItemModal'
import LocationModal from '@/components/LocationModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'

export default function LocationExplorer() {
  const { locationId } = useParams()
  const navigate = useNavigate()
  const [currentLocation, setCurrentLocation] = useState(null)
  const [childLocations, setChildLocations] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [deleteModalData, setDeleteModalData] = useState({
    type: null,
    id: null,
    name: null,
    affectedData: null,
  })
  const [editingItemId, setEditingItemId] = useState(null)
  const [quantityInput, setQuantityInput] = useState('')
  const { canEdit, isAdmin, user } = useAuth()

  useEffect(() => {
    fetchLocationData()
  }, [locationId])

  const fetchLocationData = async () => {
    setLoading(true)

    try {
      if (locationId) {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .eq('id', locationId)
          .is('deleted_at', null)
          .single()
        setCurrentLocation(data)
      } else {
        setCurrentLocation(null)
      }

      let childrenQuery = supabase
        .from('locations')
        .select('*')
        .is('deleted_at', null)

      if (locationId) {
        childrenQuery = childrenQuery.eq('parent_id', locationId)
      } else {
        childrenQuery = childrenQuery.is('parent_id', null)
      }

      const { data: children } = await childrenQuery.order('name')

      setChildLocations(children || [])

      let itemsQuery = supabase
        .from('items')
        .select(`
          *,
          category:categories(name, icon)
        `)
        .is('deleted_at', null)

      if (locationId) {
        itemsQuery = itemsQuery.eq('location_id', locationId)
      } else {
        itemsQuery = itemsQuery.is('location_id', null)
      }

      const { data: itemsData } = await itemsQuery

      setItems(itemsData || [])
    } catch (error) {
      console.error('Error fetching location data:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseBreadcrumbs = () => {
    if (!currentLocation?.path) return []
    return currentLocation.path.split(' / ')
  }

  const handleQuantityChange = async (itemId, delta, e) => {
    e.preventDefault() // Prevent navigation to item detail
    e.stopPropagation()

    const item = items.find((i) => i.id === itemId)
    if (!item) return

    const newQuantity = Math.max(0, item.quantity + delta)
    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (!error) {
      fetchLocationData()
    }
  }

  const startEditingQuantity = (item, e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingItemId(item.id)
    setQuantityInput(String(item.quantity))
  }

  const saveQuantity = async (itemId, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const newQuantity = parseInt(quantityInput)
    if (isNaN(newQuantity) || newQuantity < 0) {
      setEditingItemId(null)
      return
    }

    // Only update if value actually changed
    const item = items.find((i) => i.id === itemId)
    if (item && newQuantity === item.quantity) {
      setEditingItemId(null)
      return
    }

    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (!error) {
      await fetchLocationData()
      setEditingItemId(null)
    }
  }

  const handleQuantityKeyDown = (itemId, e) => {
    if (e.key === 'Enter') {
      saveQuantity(itemId)
    } else if (e.key === 'Escape') {
      setEditingItemId(null)
    }
  }

  const handleEditLocation = (location, e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingLocation(location)
    setShowLocationModal(true)
  }

  const fetchChildLocationsRecursive = async (parentId) => {
    const { data: children } = await supabase
      .from('locations')
      .select('id, name, path')
      .is('deleted_at', null)
      .eq('parent_id', parentId)

    if (!children || children.length === 0) return []

    // Recursively fetch children of children
    const allChildren = [...children]
    for (const child of children) {
      const grandchildren = await fetchChildLocationsRecursive(child.id)
      allChildren.push(...grandchildren)
    }

    return allChildren
  }

  const prepareDeleteLocation = async (location, e) => {
    e.preventDefault()
    e.stopPropagation()

    // Recursively fetch all child locations at any depth
    const allChildLocations = await fetchChildLocationsRecursive(location.id)

    // Fetch all items in this location and all child locations
    const locationIds = [location.id, ...allChildLocations.map(l => l.id)]
    const { data: allItems } = await supabase
      .from('items')
      .select(`
        id,
        name,
        serial_number,
        location:locations(name, path)
      `)
      .is('deleted_at', null)
      .in('location_id', locationIds)

    setDeleteModalData({
      type: 'location',
      id: location.id,
      name: location.name,
      affectedData: {
        childLocations: allChildLocations,
        items: allItems || [],
      },
    })
    setShowDeleteModal(true)
  }

  const prepareDeleteCurrentLocation = async () => {
    if (!currentLocation) return

    // Recursively fetch all child locations at any depth
    const allChildLocations = await fetchChildLocationsRecursive(currentLocation.id)

    // Fetch all items in this location and all child locations
    const locationIds = [currentLocation.id, ...allChildLocations.map(l => l.id)]
    const { data: allItems } = await supabase
      .from('items')
      .select(`
        id,
        name,
        serial_number,
        location:locations(name, path)
      `)
      .is('deleted_at', null)
      .in('location_id', locationIds)

    setDeleteModalData({
      type: 'location',
      id: currentLocation.id,
      name: currentLocation.name,
      affectedData: {
        childLocations: allChildLocations,
        items: allItems || [],
      },
    })
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const { id } = deleteModalData
    const wasCurrentLocation = id === currentLocation?.id

    const { error } = await supabase
      .from('locations')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      })
      .eq('id', id)

    if (!error) {
      // If we deleted the current location, navigate to parent or root
      if (wasCurrentLocation) {
        navigate(currentLocation.parent_id ? `/locations/${currentLocation.parent_id}` : '/locations')
      } else {
        // Otherwise, just refresh the current location data
        fetchLocationData()
      }
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {currentLocation?.image_url && (
        <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden shadow-lg mb-6">
          <img
            src={currentLocation.image_url}
            alt={currentLocation.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.parentElement.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mb-2 overflow-x-auto pb-1">
            <Link to="/locations" className="hover:text-primary flex-shrink-0">
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
            {parseBreadcrumbs().map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="whitespace-nowrap">{crumb}</span>
              </div>
            ))}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {currentLocation?.name || 'All Locations'}
          </h1>
          {currentLocation?.description && (
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {currentLocation.description}
            </p>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {currentLocation && (
              <>
                <button
                  onClick={() => {
                    setEditingLocation(currentLocation)
                    setShowLocationModal(true)
                  }}
                  className="flex items-center gap-2 border px-3 sm:px-4 py-2 rounded-md hover:bg-secondary transition-colors text-sm"
                  title="Edit this location"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={prepareDeleteCurrentLocation}
                    className="flex items-center gap-2 border border-destructive text-destructive px-3 sm:px-4 py-2 rounded-md hover:bg-destructive/10 transition-colors text-sm"
                    title="Delete this location"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => {
                setEditingLocation(null)
                setShowLocationModal(true)
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-md hover:opacity-90 text-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">Add Location</span>
              <span className="xs:hidden">Add</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {childLocations.length > 0 && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Sub-Locations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {childLocations.map((location) => (
                  <div key={location.id} className="relative group">
                    <Link
                      to={`/locations/${location.id}`}
                      className="block bg-card border rounded-lg p-4 sm:p-6 hover:border-primary transition-colors"
                    >
                      {location.image_url && (
                        <div className="mb-3">
                          <img
                            src={location.image_url}
                            alt={location.name}
                            className="w-full h-32 object-cover rounded-md border"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <h3 className="font-semibold text-lg sm:text-xl pr-16 sm:pr-0">{location.name}</h3>
                      {location.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{location.description}</p>
                      )}
                    </Link>
                    {canEdit && (
                      <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEditLocation(location, e)}
                          className="p-1.5 bg-background border rounded-md hover:bg-secondary transition-colors"
                          title="Edit location"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => prepareDeleteLocation(location, e)}
                            className="p-1.5 bg-background border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                            title="Delete location"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Items at this Location</h2>
              {canEdit && (
                <button
                  onClick={() => setShowItemModal(true)}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 text-sm sm:text-base"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                No items at this location
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/items/${item.id}`}
                    className="bg-card border rounded-lg p-4 hover:border-primary transition-colors group relative"
                  >
                    {item.image_url && (
                      <div className="mb-3">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-32 object-cover rounded-md border"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{item.name}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {item.category?.icon && <span className="mr-1">{item.category.icon}</span>}
                          {item.category?.name || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {editingItemId === item.id ? (
                        <input
                          type="number"
                          min="0"
                          value={quantityInput}
                          onChange={(e) => setQuantityInput(e.target.value)}
                          onBlur={(e) => saveQuantity(item.id, e)}
                          onKeyDown={(e) => handleQuantityKeyDown(item.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="text-sm font-medium w-20 px-2 py-1 border rounded-md bg-background"
                        />
                      ) : (
                        <span
                          onClick={(e) => canEdit ? startEditingQuantity(item, e) : null}
                          className={`text-xs sm:text-sm font-medium ${canEdit ? 'cursor-pointer hover:text-primary transition-colors' : 'text-muted-foreground'}`}
                          title={canEdit ? 'Click to edit quantity' : ''}
                        >
                          Qty: {item.quantity}
                        </span>
                      )}
                      {canEdit && editingItemId !== item.id && (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <button
                            onClick={(e) => handleQuantityChange(item.id, -1, e)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleQuantityChange(item.id, 1, e)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md transition-colors"
                            title="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ItemModal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSuccess={fetchLocationData}
        locationId={locationId}
      />

      <LocationModal
        isOpen={showLocationModal}
        onClose={() => {
          setShowLocationModal(false)
          setEditingLocation(null)
        }}
        onSuccess={fetchLocationData}
        location={editingLocation}
        parentId={locationId}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Location"
        itemName={deleteModalData.name || ''}
        itemType={deleteModalData.type}
        userEmail={user?.email || ''}
        affectedData={deleteModalData.affectedData}
      />
    </div>
  )
}
