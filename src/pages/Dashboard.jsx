import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Package, MapPin, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import TreeView from '@/components/TreeView'
import LowQuantityItems from '@/components/LowQuantityItems'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalItems: 0,
    checkedOut: 0,
    locations: 0,
  })
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    try {
      const [itemsResult, locationsResult, locationsData, checkoutLogsResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            *,
            category:categories(name, icon),
            location:locations(name, path)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('locations').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('locations').select('*').is('deleted_at', null).order('path'),
        supabase
          .from('checkout_logs')
          .select('id, checked_out_to, checked_out_at, checkout_notes')
          .is('checked_in_at', null),
      ])

      if (itemsResult.data) {
        // Create a map of checkout logs by ID for quick lookup
        const checkoutLogsMap = {}
        if (checkoutLogsResult.data) {
          checkoutLogsResult.data.forEach(log => {
            checkoutLogsMap[log.id] = log
          })
        }

        // Merge checkout log data into items
        const itemsWithCheckoutData = itemsResult.data.map(item => ({
          ...item,
          checkout_log: item.checkout_log_id ? checkoutLogsMap[item.checkout_log_id] : null
        }))

        setItems(itemsWithCheckoutData)
        setStats({
          totalItems: itemsWithCheckoutData.length,
          checkedOut: itemsWithCheckoutData.filter((item) => item.checkout_log_id).length,
          locations: locationsResult.count || 0,
        })
      }

      if (locationsData.data) {
        setLocations(locationsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Welcome to your inventory management system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalItems}</p>
            </div>
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Checked Out</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.checkedOut}</p>
            </div>
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Locations</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.locations}</p>
            </div>
            <MapPin className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <h2 className="text-lg sm:text-xl font-semibold">Location Hierarchy</h2>
        </div>
        <div className="max-h-64 sm:max-h-96 overflow-y-auto">
          <TreeView
            locations={locations}
            onLocationClick={(location) => setSelectedLocation(location.id)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <h2 className="text-lg sm:text-xl font-semibold">Currently Checked Out Items</h2>
          <span className="text-sm text-muted-foreground">({items.filter(item => item.checkout_log_id).length})</span>
        </div>
        {items.filter(item => item.checkout_log_id).length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {items.filter(item => item.checkout_log_id).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border hover:border-primary transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0 border"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/items/${item.id}`}
                      className="text-primary hover:underline font-medium block truncate"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {item.category?.icon && <span className="mr-1">{item.category.icon}</span>}
                      {item.category?.name || 'Uncategorized'} • {item.location?.name || 'Unknown location'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Checked out to:</p>
                    <p className="text-sm font-medium">{item.checkout_log?.checked_out_to || 'Unknown'}</p>
                  </div>
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    Out
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No items are currently checked out</p>
        )}
      </div>

      <LowQuantityItems />
    </div>
  )
}
