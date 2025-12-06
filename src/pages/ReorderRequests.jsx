import { useState, useEffect, memo, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Search, ExternalLink, Package } from 'lucide-react'
import ReorderRequestModal from '@/components/ReorderRequestModal'
import Fuse from 'fuse.js'

const STATUS_CONFIG = {
  new_request: { label: 'New Request', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
  approved_pending: { label: 'Approved / Pending', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  purchased: { label: 'Purchased', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200' },
  arrived: { label: 'Arrived', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
  documented: { label: 'Documented', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
  standard: { label: 'Standard', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200' },
}

const ROLE_CONFIG = {
  admin: { label: 'Pro Staff', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
  coordinator: { label: 'Lead', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
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
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0)
}

// Mobile Card Component
const MobileRequestCard = memo(({ request, onClick }) => {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.new_request
  const priorityConfig = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.standard
  const roleConfig = ROLE_CONFIG[request.requested_by_user?.role]
  const relevantDate = getRelevantDate(request)
  const totalCost = (parseFloat(request.price_per_pack) || 0) * (parseInt(request.quantity_to_order) || 0)

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
          <span className="text-muted-foreground">Total Cost:</span>
          <div className="font-medium mt-0.5 text-green-600 dark:text-green-400">
            {formatCurrency(totalCost)}
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
          <div className="font-medium mt-0.5 flex items-center gap-2">
            {request.requested_by_name || request.requested_by_user?.email || 'Unknown'}
            {roleConfig && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${roleConfig.color}`}>
                {roleConfig.label}
              </span>
            )}
          </div>
        </div>
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
  const totalCost = (parseFloat(request.price_per_pack) || 0) * (parseInt(request.quantity_to_order) || 0)

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer"
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
      <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
        {formatCurrency(totalCost)}
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
        <div className="flex items-center gap-2">
          <span className="text-sm">{request.requested_by_name || request.requested_by_user?.email || 'Unknown'}</span>
          {roleConfig && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${roleConfig.color}`}>
              {roleConfig.label}
            </span>
          )}
        </div>
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

  useEffect(() => {
    fetchRequests()
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

  // Filter requests based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRequests(requests)
    } else {
      // Also check for status label matches
      const statusMatch = Object.entries(STATUS_CONFIG).find(
        ([key, config]) => config.label.toLowerCase().includes(searchQuery.toLowerCase())
      )

      if (statusMatch) {
        const [statusKey] = statusMatch
        const statusFiltered = requests.filter(r => r.status === statusKey)
        const fuseResults = fuse.search(searchQuery).map(r => r.item)
        // Combine and dedupe
        const combined = [...new Map([...statusFiltered, ...fuseResults].map(r => [r.id, r])).values()]
        setFilteredRequests(combined)
      } else {
        const results = fuse.search(searchQuery)
        setFilteredRequests(results.map(r => r.item))
      }
    }
  }, [searchQuery, requests, fuse])

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
            {searchQuery && ` matching "${searchQuery}"`}
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

      {/* Results */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Requests Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Create your first reorder request to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleNewRequest}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New Request
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
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Link</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Requestor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
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
