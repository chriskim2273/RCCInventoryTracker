import { useState, useEffect, memo, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate as utilsFormatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Search, ExternalLink, Package, ChevronUp, ChevronDown } from 'lucide-react'
import ReorderRequestModal from '@/components/ReorderRequestModal'
import Fuse from 'fuse.js'

const STATUS_CONFIG = {
  new_request: { label: 'New Request', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200', order: 1 },
  approved_pending: { label: 'Approved / Pending', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200', order: 2 },
  purchased: { label: 'Purchased', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200', order: 3 },
  arrived: { label: 'Arrived', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200', order: 4 },
  documented: { label: 'Documented', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200', order: 5 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200', order: 6 },
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200', order: 1 },
  standard: { label: 'Standard', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200', order: 2 },
}

const ROLE_CONFIG = {
  admin: { label: 'Pro Staff', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-800 dark:text-red-200' },
  coordinator: { label: 'Lead', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-800 dark:text-yellow-200' },
}

// Get relevant date based on status
const getRelevantDate = (request) => {
  switch (request.status) {
    case 'documented':
      return { label: 'Documented', date: request.documented_on }
    case 'arrived':
      return { label: 'Arrived', date: request.arrived_on }
    case 'purchased':
      return { label: 'Purchased', date: request.purchased_on }
    default:
      return { label: 'Requested', date: request.date_requested }
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return utilsFormatDate(dateStr, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}


// Mobile Card Component
const MobileRequestCard = memo(({ request, onClick }) => {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.new_request
  const priorityConfig = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.standard
  const roleConfig = ROLE_CONFIG[request.requested_by_user?.role]
  const relevantDate = getRelevantDate(request)

  return (
    <div
      className="bg-card border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base truncate">{request.item_name}</h3>
          {request.item_brand && (
            <p className="text-sm text-muted-foreground">{request.item_brand}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.color}`}>
          {priorityConfig.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
        {request.category && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted">
            {request.category.icon} {request.category.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Quantity:</span>
          <div className="font-medium mt-0.5">
            {request.quantity_to_order}
            {request.units_per_pack && ` (${request.units_per_pack}/pack)`}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Location:</span>
          <div className="font-medium mt-0.5">{request.location?.name || 'Unknown'}</div>
        </div>
        <div>
          <span className="text-muted-foreground">{relevantDate.label}:</span>
          <div className="font-medium mt-0.5">{formatDate(relevantDate.date)}</div>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Requestor:</span>
          <div className="font-medium mt-0.5">
            <span
              className={`${roleConfig ? `px-1.5 py-0.5 rounded ${roleConfig.bgColor} ${roleConfig.textColor}` : ''}`}
              title={roleConfig ? roleConfig.label : undefined}
            >
              {request.requested_by_name || request.requested_by_user?.email || 'Unknown'}
            </span>
          </div>
        </div>
        {request.purchased_on && (
          <div>
            <span className="text-muted-foreground">Purchased:</span>
            <div className="font-medium mt-0.5">{formatDate(request.purchased_on)}</div>
          </div>
        )}
        {(request.purchased_by_name || request.purchased_by_user) && (
          <div>
            <span className="text-muted-foreground">Purchased By:</span>
            <div className="font-medium mt-0.5">
              {request.purchased_by_name ||
                (request.purchased_by_user?.first_name && request.purchased_by_user?.last_name
                  ? `${request.purchased_by_user.first_name} ${request.purchased_by_user.last_name}`
                  : request.purchased_by_user?.email) || 'Unknown'}
            </div>
          </div>
        )}
      </div>

      {request.order_link && (
        <a
          href={request.order_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
          Order Link
        </a>
      )}
    </div>
  )
})

MobileRequestCard.displayName = 'MobileRequestCard'

// Desktop Table Row Component
const DesktopRequestRow = memo(({ request, onClick }) => {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.new_request
  const priorityConfig = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.standard
  const roleConfig = ROLE_CONFIG[request.requested_by_user?.role]
  const relevantDate = getRelevantDate(request)

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer h-14"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.color}`}>
          {priorityConfig.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div>
          <span className="font-medium">{request.item_name}</span>
          {request.item_brand && (
            <span className="text-sm text-muted-foreground ml-2">({request.item_brand})</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {request.category ? (
          <span className="inline-flex items-center gap-1 text-sm">
            {request.category.icon} {request.category.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {request.quantity_to_order}
        {request.units_per_pack && (
          <span className="text-muted-foreground ml-1">({request.units_per_pack}/pk)</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {request.order_link ? (
          <a
            href={request.order_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            Link
          </a>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">{request.location?.name || 'Unknown'}</td>
      <td className="px-4 py-3">
        <span
          className={`text-sm ${roleConfig ? `px-1.5 py-0.5 rounded ${roleConfig.bgColor} ${roleConfig.textColor}` : ''}`}
          title={roleConfig ? roleConfig.label : undefined}
        >
          {request.requested_by_name || request.requested_by_user?.email || 'Unknown'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <div>
          <span className="text-muted-foreground">{relevantDate.label}:</span>
          <div>{formatDate(relevantDate.date)}</div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {request.purchased_by_name ||
          (request.purchased_by_user?.first_name && request.purchased_by_user?.last_name
            ? `${request.purchased_by_user.first_name} ${request.purchased_by_user.last_name}`
            : request.purchased_by_user?.email) || <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 text-sm max-w-[200px]">
        {request.notes ? (
          <span className="truncate block" title={request.notes}>{request.notes}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
})

DesktopRequestRow.displayName = 'DesktopRequestRow'

export default function ReorderRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [filteredRequests, setFilteredRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  // Filter state
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])

  // Sort state
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'

  useEffect(() => {
    fetchRequests()
    fetchFilterData()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reorder_requests')
        .select(`
          *,
          item:items(id, name, brand, model, image_url),
          category:categories(id, name, icon),
          location:locations(id, name, path),
          requested_by_user:users!requested_by(id, email, first_name, last_name, role),
          purchased_by_user:users!purchased_by(id, email, first_name, last_name)
        `)
        .order('status_updated_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
      setFilteredRequests(data || [])
    } catch (err) {
      console.error('Error fetching reorder requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilterData = async () => {
    try {
      const [categoriesResult, locationsResult] = await Promise.all([
        supabase.from('categories').select('*').is('deleted_at', null).order('name'),
        supabase.from('locations').select('*').is('deleted_at', null).is('parent_id', null).order('path'),
      ])

      if (categoriesResult.data) setCategories(categoriesResult.data)
      if (locationsResult.data) setLocations(locationsResult.data)
    } catch (err) {
      console.error('Error fetching filter data:', err)
    }
  }

  // Fuse.js configuration for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(requests, {
      keys: [
        { name: 'item_name', weight: 3 },
        { name: 'item_brand', weight: 1 },
        { name: 'item_model', weight: 1 },
        { name: 'category.name', weight: 1 },
        { name: 'location.name', weight: 1 },
        { name: 'requested_by_name', weight: 1 },
        { name: 'requested_by_user.first_name', weight: 1 },
        { name: 'requested_by_user.last_name', weight: 1 },
        { name: 'purchased_by_name', weight: 1 },
        { name: 'purchased_by_user.first_name', weight: 1 },
        { name: 'purchased_by_user.last_name', weight: 1 },
        { name: 'status', weight: 2 },
        { name: 'notes', weight: 0.5 },
      ],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
  }, [requests])

  // Sort function
  const sortRequests = (requestsToSort) => {
    return [...requestsToSort].sort((a, b) => {
      // Primary sort: status
      const statusOrderA = STATUS_CONFIG[a.status]?.order || 99
      const statusOrderB = STATUS_CONFIG[b.status]?.order || 99

      if (statusOrderA !== statusOrderB) {
        return sortDirection === 'asc'
          ? statusOrderA - statusOrderB
          : statusOrderB - statusOrderA
      }

      // Secondary sort: priority (high first)
      const priorityOrderA = PRIORITY_CONFIG[a.priority]?.order || 99
      const priorityOrderB = PRIORITY_CONFIG[b.priority]?.order || 99

      return sortDirection === 'asc'
        ? priorityOrderA - priorityOrderB
        : priorityOrderB - priorityOrderA
    })
  }

  // Filter and sort requests
  useEffect(() => {
    let filtered = [...requests]

    // Filter by search query
    if (searchQuery.trim()) {
      // Also check for status label matches
      const statusMatch = Object.entries(STATUS_CONFIG).find(
        ([key, config]) => config.label.toLowerCase().includes(searchQuery.toLowerCase())
      )

      if (statusMatch) {
        const [statusKey] = statusMatch
        const statusFiltered = requests.filter(r => r.status === statusKey)
        const fuseResults = fuse.search(searchQuery).map(r => r.item)
        // Combine and dedupe
        filtered = [...new Map([...statusFiltered, ...fuseResults].map(r => [r.id, r])).values()]
      } else {
        const results = fuse.search(searchQuery)
        filtered = results.map(r => r.item)
      }
    }

    // Filter by status
    if (selectedStatus) {
      filtered = filtered.filter(r => r.status === selectedStatus)
    }

    // Filter by priority
    if (selectedPriority) {
      filtered = filtered.filter(r => r.priority === selectedPriority)
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(r => r.category_id === selectedCategory)
    }

    // Filter by location
    if (selectedLocation) {
      filtered = filtered.filter(r => r.location_id === selectedLocation)
    }

    // Apply sorting
    const sorted = sortRequests(filtered)
    setFilteredRequests(sorted)
  }, [searchQuery, requests, fuse, selectedStatus, selectedPriority, selectedCategory, selectedLocation, sortDirection])

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setSelectedStatus('')
    setSelectedPriority('')
    setSelectedCategory('')
    setSelectedLocation('')
  }

  const hasActiveFilters = searchQuery || selectedStatus || selectedPriority || selectedCategory || selectedLocation

  const handleRowClick = (request) => {
    setSelectedRequest(request)
    setShowModal(true)
  }

  const handleNewRequest = () => {
    setSelectedRequest(null)
    setShowModal(true)
  }

  const handleModalSuccess = () => {
    fetchRequests()
    setShowModal(false)
    setSelectedRequest(null)
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Reorder Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Reorder Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
        <button
          onClick={handleNewRequest}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 sm:space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by item, requestor, category, status, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded-md bg-background"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Toggle and Clear Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleSortDirection}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md bg-background hover:bg-muted transition-colors"
          >
            {sortDirection === 'asc' ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Status: New → Documented
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Status: Documented → New
              </>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Requests Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters or search terms'
              : 'Create your first reorder request to get started'}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={handleNewRequest}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New Request
            </button>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="lg:hidden space-y-3">
            {filteredRequests.map((request) => (
              <MobileRequestCard
                key={request.id}
                request={request}
                onClick={() => handleRowClick(request)}
              />
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block bg-card border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Link</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Requestor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Purchased By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRequests.map((request) => (
                  <DesktopRequestRow
                    key={request.id}
                    request={request}
                    onClick={() => handleRowClick(request)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      <ReorderRequestModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedRequest(null)
        }}
        onSuccess={handleModalSuccess}
        request={selectedRequest}
      />
    </div>
  )
}
