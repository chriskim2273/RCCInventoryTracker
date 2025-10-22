import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Package } from 'lucide-react'

export default function LowQuantityItems() {
  const [lowQuantityItems, setLowQuantityItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLowQuantityItems()
  }, [])

  const fetchLowQuantityItems = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(name, icon),
          location:locations(name, path)
        `)
        .is('deleted_at', null)
        .not('min_quantity', 'is', null)

      if (error) throw error

      if (data) {
        // Filter items where quantity is below min_quantity
        const lowItems = data.filter(item => item.quantity < item.min_quantity)
        setLowQuantityItems(lowItems)
      }
    } catch (error) {
      console.error('Error fetching low quantity items:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-500" />
          <h2 className="text-lg sm:text-xl font-semibold">Low Quantity Items</h2>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-500" />
        <h2 className="text-lg sm:text-xl font-semibold">Low Quantity Items</h2>
        {lowQuantityItems.length > 0 && (
          <span className="text-sm text-muted-foreground">({lowQuantityItems.length})</span>
        )}
      </div>

      {lowQuantityItems.length > 0 ? (
        <div className="space-y-2 sm:space-y-3">
          {lowQuantityItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-md border border-yellow-200 dark:border-yellow-900/50 hover:border-yellow-400 dark:hover:border-yellow-700 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0 border"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-muted border flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/items/${item.id}`}
                    className="text-primary hover:underline font-medium block truncate"
                  >
                    {item.name}
                  </Link>
                  {item.serial_number && (
                    <p className="text-xs text-muted-foreground truncate">SN: {item.serial_number}</p>
                  )}
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {item.category?.icon && <span className="mr-1">{item.category.icon}</span>}
                    {item.category?.name || 'Uncategorized'} • {item.location?.name || 'Unknown location'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Current / Min</p>
                  <p className="text-sm font-semibold">
                    <span className="text-yellow-700 dark:text-yellow-500">{item.quantity}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span>{item.min_quantity}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">All items are at or above their minimum quantity levels</p>
        </div>
      )}
    </div>
  )
}
