import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Tag, History, Edit, Shield, Trash2, RotateCcw, Search, X, Package, MapPin, Plus, Mail, Key, UserX, CheckCircle, XCircle } from 'lucide-react'
import CategoryModal from '@/components/CategoryModal'
import ItemModal from '@/components/ItemModal'
import LocationModal from '@/components/LocationModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import RoleChangeConfirmationModal from '@/components/RoleChangeConfirmationModal'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDetails, deleteUser, resendConfirmationEmail, resetUserPassword } from '@/lib/adminApi'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [adminAuditLogs, setAdminAuditLogs] = useState([])
  const [deletedItems, setDeletedItems] = useState([])
  const [deletedLocations, setDeletedLocations] = useState([])
  const [deletedCategories, setDeletedCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteModalData, setDeleteModalData] = useState({
    type: null,
    id: null,
    name: null,
    affectedData: null,
  })
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false)
  const [roleChangeData, setRoleChangeData] = useState({
    user: null,
    newRole: null,
  })
  const { user: currentUser, canManageUsers } = useAuth()

  // Filter states
  const [auditSearchQuery, setAuditSearchQuery] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('all')
  const [auditUserFilter, setAuditUserFilter] = useState('all')

  const [adminAuditActionFilter, setAdminAuditActionFilter] = useState('all')
  const [adminAuditUserFilter, setAdminAuditUserFilter] = useState('all')

  const [deletedSearchQuery, setDeletedSearchQuery] = useState('')
  const [deletedTypeFilter, setDeletedTypeFilter] = useState('all')
  const [deletedUserFilter, setDeletedUserFilter] = useState('all')

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'string' && value.length === 0) return '(empty)'
    return String(value)
  }

  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User'
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.email || 'Unknown User'
  }

  // Filtered data using useMemo
  const filteredAuditLogs = useMemo(() => {
    let filtered = [...auditLogs]

    if (auditSearchQuery) {
      const query = auditSearchQuery.toLowerCase()
      filtered = filtered.filter(log =>
        log.item?.name?.toLowerCase().includes(query)
      )
    }

    if (auditActionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === auditActionFilter)
    }

    if (auditUserFilter !== 'all') {
      filtered = filtered.filter(log => log.user_id === auditUserFilter)
    }

    return filtered
  }, [auditLogs, auditSearchQuery, auditActionFilter, auditUserFilter])

  const filteredAdminAuditLogs = useMemo(() => {
    let filtered = [...adminAuditLogs]

    if (adminAuditActionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === adminAuditActionFilter)
    }

    if (adminAuditUserFilter !== 'all') {
      filtered = filtered.filter(log => log.user_id === adminAuditUserFilter)
    }

    return filtered
  }, [adminAuditLogs, adminAuditActionFilter, adminAuditUserFilter])

  const filteredDeletedItems = useMemo(() => {
    if (deletedTypeFilter !== 'all' && deletedTypeFilter !== 'items') return []

    let filtered = [...deletedItems]

    if (deletedSearchQuery) {
      const query = deletedSearchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(query) ||
        item.serial_number?.toLowerCase().includes(query)
      )
    }

    if (deletedUserFilter !== 'all') {
      filtered = filtered.filter(item => item.deleted_by === deletedUserFilter)
    }

    return filtered
  }, [deletedItems, deletedSearchQuery, deletedTypeFilter, deletedUserFilter])

  const filteredDeletedLocations = useMemo(() => {
    if (deletedTypeFilter !== 'all' && deletedTypeFilter !== 'locations') return []

    let filtered = [...deletedLocations]

    if (deletedSearchQuery) {
      const query = deletedSearchQuery.toLowerCase()
      filtered = filtered.filter(location =>
        location.name?.toLowerCase().includes(query) ||
        location.path?.toLowerCase().includes(query)
      )
    }

    if (deletedUserFilter !== 'all') {
      filtered = filtered.filter(location => location.deleted_by === deletedUserFilter)
    }

    return filtered
  }, [deletedLocations, deletedSearchQuery, deletedTypeFilter, deletedUserFilter])

  const filteredDeletedCategories = useMemo(() => {
    if (deletedTypeFilter !== 'all' && deletedTypeFilter !== 'categories') return []

    let filtered = [...deletedCategories]

    if (deletedSearchQuery) {
      const query = deletedSearchQuery.toLowerCase()
      filtered = filtered.filter(category =>
        category.name?.toLowerCase().includes(query)
      )
    }

    if (deletedUserFilter !== 'all') {
      filtered = filtered.filter(category => category.deleted_by === deletedUserFilter)
    }

    return filtered
  }, [deletedCategories, deletedSearchQuery, deletedTypeFilter, deletedUserFilter])

  // Get unique users for filters
  const auditUsers = useMemo(() => {
    const uniqueUsers = new Map()
    auditLogs.forEach(log => {
      if (log.user_id && log.user) {
        uniqueUsers.set(log.user_id, log.user)
      }
    })
    return Array.from(uniqueUsers.entries()).map(([id, user]) => ({ id, user }))
  }, [auditLogs])

  const adminAuditUsers = useMemo(() => {
    const uniqueUsers = new Map()
    adminAuditLogs.forEach(log => {
      if (log.user_id && log.user) {
        uniqueUsers.set(log.user_id, log.user)
      }
    })
    return Array.from(uniqueUsers.entries()).map(([id, user]) => ({ id, user }))
  }, [adminAuditLogs])

  const deletedByUsers = useMemo(() => {
    const uniqueUsers = new Map()
      ;[...deletedItems, ...deletedLocations, ...deletedCategories].forEach(item => {
        if (item.deleted_by && item.deleted_by_user) {
          uniqueUsers.set(item.deleted_by, item.deleted_by_user)
        }
      })
    return Array.from(uniqueUsers.entries()).map(([id, user]) => ({ id, user }))
  }, [deletedItems, deletedLocations, deletedCategories])

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)

    try {
      if (activeTab === 'users') {
        // Use the admin API to get detailed user information including auth status
        try {
          const { users: detailedUsers } = await getUserDetails()
          setUsers(detailedUsers || [])
        } catch (error) {
          console.error('Error fetching user details:', error)
          // Fallback to basic user data if admin API fails
          const { data } = await supabase
            .from('users')
            .select('*, first_name, last_name')
            .order('created_at', { ascending: false })
          setUsers(data || [])
        }
      } else if (activeTab === 'items') {
        const { data } = await supabase
          .from('items')
          .select(`
            *,
            category:categories(name),
            location:locations(name, path),
            created_by_user:users!items_created_by_fkey(email, first_name, last_name)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        setItems(data || [])
      } else if (activeTab === 'locations') {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .is('deleted_at', null)
          .order('path')
        setLocations(data || [])
      } else if (activeTab === 'categories') {
        const { data } = await supabase.from('categories').select('*').is('deleted_at', null).order('name')
        setCategories(data || [])
      } else if (activeTab === 'audit') {
        const { data } = await supabase
          .from('item_logs')
          .select(`
            *,
            item:items(name),
            user:users(email, first_name, last_name)
          `)
          .order('timestamp', { ascending: false })
          .limit(100)
        setAuditLogs(data || [])
      } else if (activeTab === 'admin-audit') {
        const { data } = await supabase
          .from('audit_logs')
          .select(`
            *,
            user:users(email, first_name, last_name)
          `)
          .order('created_at', { ascending: false })
          .limit(100)
        setAdminAuditLogs(data || [])
      } else if (activeTab === 'deleted') {
        const [itemsData, locationsData, categoriesData] = await Promise.all([
          supabase
            .from('items')
            .select(`
              *,
              category:categories(name),
              location:locations(name),
              deleted_by_user:users!items_deleted_by_fkey(email, first_name, last_name)
            `)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false }),
          supabase
            .from('locations')
            .select(`
              *,
              deleted_by_user:users!locations_deleted_by_fkey(email, first_name, last_name)
            `)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false }),
          supabase
            .from('categories')
            .select(`
              *,
              deleted_by_user:users!categories_deleted_by_fkey(email, first_name, last_name)
            `)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false }),
        ])
        setDeletedItems(itemsData.data || [])
        setDeletedLocations(locationsData.data || [])
        setDeletedCategories(categoriesData.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const prepareRoleChange = (user, newRole) => {
    // Don't show modal if role hasn't changed
    if (user.role === newRole) return

    setRoleChangeData({ user, newRole })
    setShowRoleChangeModal(true)
  }

  const updateUserRole = async () => {
    const { user, newRole } = roleChangeData

    try {
      // Update the user's role
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Log the role change in admin audit logs
      const { error: auditError } = await supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: currentUser.id,
          action: 'role_change',
          target_user_id: user.id,
          details: {
            user_email: user.email,
            old_role: user.role,
            new_role: newRole,
            timestamp: new Date().toISOString()
          }
        })

      if (auditError) console.error('Error logging role change:', auditError)

      // Refresh data
      await fetchData()

      setShowRoleChangeModal(false)
      setRoleChangeData({ user: null, newRole: null })
    } catch (error) {
      console.error('Error updating user role:', error)
      throw error
    }
  }

  // Admin API handlers
  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteUser(userId)
      alert('User deleted successfully')
      await fetchData()
    } catch (error) {
      alert(`Failed to delete user: ${error.message}`)
    }
  }

  const handleResendConfirmation = async (email) => {
    try {
      await resendConfirmationEmail(email)
      alert(`Confirmation email resent to ${email}`)
    } catch (error) {
      alert(`Failed to resend confirmation: ${error.message}`)
    }
  }

  const handleResetPassword = async (userId, userEmail) => {
    const newPassword = prompt(`Enter new password for ${userEmail}:`)
    if (!newPassword) return

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    try {
      await resetUserPassword(userId, newPassword)
      alert('Password reset successfully')
    } catch (error) {
      alert(`Failed to reset password: ${error.message}`)
    }
  }

  const prepareDeleteItem = async (itemId, itemName) => {
    setDeleteModalData({
      type: 'item',
      id: itemId,
      name: itemName,
      affectedData: null,
    })
    setShowDeleteModal(true)
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

  const prepareDeleteLocation = async (locationId, locationName) => {
    // Recursively fetch all child locations at any depth
    const allChildLocations = await fetchChildLocationsRecursive(locationId)

    // Fetch all items in this location and all child locations
    const locationIds = [locationId, ...allChildLocations.map(l => l.id)]
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
      id: locationId,
      name: locationName,
      affectedData: {
        childLocations: allChildLocations,
        items: allItems || [],
      },
    })
    setShowDeleteModal(true)
  }

  const prepareDeleteCategory = async (categoryId, categoryName) => {
    // Fetch items that use this category
    const { data: itemsData } = await supabase
      .from('items')
      .select(`
        id,
        name,
        serial_number,
        location:locations(name, path)
      `)
      .is('deleted_at', null)
      .eq('category_id', categoryId)

    setDeleteModalData({
      type: 'category',
      id: categoryId,
      name: categoryName,
      affectedData: {
        items: itemsData || [],
      },
    })
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    const { type, id, name, affectedData } = deleteModalData

    if (type === 'item') {
      const { error } = await supabase
        .from('items')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser?.id,
        })
        .eq('id', id)

      if (!error) {
        fetchData()
      }
    } else if (type === 'location') {
      // Get the location details for logging
      const { data: locationData } = await supabase
        .from('locations')
        .select('name, path')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('locations')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser?.id,
        })
        .eq('id', id)

      if (!error) {
        // Log to admin audit logs
        await supabase.from('audit_logs').insert({
          user_id: currentUser?.id,
          action: 'delete_location',
          details: {
            location_name: locationData?.name || name,
            location_path: locationData?.path,
            child_locations_count: affectedData?.childLocations?.length || 0,
            affected_items_count: affectedData?.items?.length || 0,
          },
        })

        fetchData()
      }
    } else if (type === 'category') {
      // First, set category_id to NULL for all affected items
      const affectedItemIds = deleteModalData.affectedData?.items?.map((item) => item.id) || []

      if (affectedItemIds.length > 0) {
        await supabase
          .from('items')
          .update({ category_id: null })
          .in('id', affectedItemIds)
      }

      // Then soft-delete the category
      const { error } = await supabase
        .from('categories')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser?.id,
        })
        .eq('id', id)

      if (!error) {
        fetchData()
      }
    }
  }

  const restoreItem = async (itemId) => {
    if (!confirm('Are you sure you want to restore this item?')) return

    // Get the item details for logging
    const { data: itemData } = await supabase
      .from('items')
      .select('name, serial_number')
      .eq('id', itemId)
      .single()

    const { error } = await supabase
      .from('items')
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq('id', itemId)

    if (!error) {
      // Log to admin audit logs
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id,
        action: 'restore_item',
        details: {
          item_name: itemData?.name,
          item_serial_number: itemData?.serial_number,
        },
      })

      fetchData()
    }
  }

  const restoreLocation = async (locationId) => {
    if (!confirm('Are you sure you want to restore this location?')) return

    // Get the location details for logging
    const { data: locationData } = await supabase
      .from('locations')
      .select('name, path')
      .eq('id', locationId)
      .single()

    const { error } = await supabase
      .from('locations')
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq('id', locationId)

    if (!error) {
      // Log to admin audit logs
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id,
        action: 'restore_location',
        details: {
          location_name: locationData?.name,
          location_path: locationData?.path,
        },
      })

      fetchData()
    }
  }

  const restoreCategory = async (categoryId) => {
    if (!confirm('Are you sure you want to restore this category?')) return

    // Get the category details for logging
    const { data: categoryData } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single()

    const { error } = await supabase
      .from('categories')
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq('id', categoryId)

    if (!error) {
      // Log to admin audit logs
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id,
        action: 'restore_category',
        details: {
          category_name: categoryData?.name,
        },
      })

      fetchData()
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Manage users, categories, and view audit logs</p>
      </div>

      <div className="border-b -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-px scrollbar-hide">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <Users className="h-4 w-4" />
            Users
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'items'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <Package className="h-4 w-4" />
            Items
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'locations'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <MapPin className="h-4 w-4" />
            Locations
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'categories'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <Tag className="h-4 w-4" />
            Categories
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'audit'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Item Audit Trail</span>
            <span className="sm:hidden">Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('admin-audit')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'admin-audit'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Admin Actions</span>
            <span className="sm:hidden">Admin</span>
          </button>

          <button
            onClick={() => setActiveTab('deleted')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap ${activeTab === 'deleted'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Deleted Items</span>
            <span className="sm:hidden">Deleted</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <>
          {activeTab === 'users' && (
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Last Sign In</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Change Role</th>
                      {canManageUsers && (
                        <th className="px-4 py-3 text-left text-sm font-medium">Admin Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {user.confirmed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="h-3 w-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <XCircle className="h-3 w-3" />
                                Unverified
                              </span>
                            )}
                            {user.banned && (
                              <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Banned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : user.role === 'coordinator'
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                                  : user.role === 'editor'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : user.role === 'viewer'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          {canManageUsers ? (
                            <select
                              value={user.role}
                              onChange={(e) => prepareRoleChange(user, e.target.value)}
                              className="text-sm border rounded px-2 py-1 bg-background"
                            >
                              <option value="pending">Pending</option>
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                              <option value="coordinator">Coordinator</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No permission
                            </span>
                          )}
                        </td>
                        {canManageUsers && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!user.confirmed && (
                                <button
                                  onClick={() => handleResendConfirmation(user.email)}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                  title="Resend confirmation email"
                                >
                                  <Mail className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleResetPassword(user.id, user.email)}
                                className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                                title="Reset password"
                              >
                                <Key className="h-4 w-4" />
                              </button>
                              {user.id !== currentUser.id && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                  title="Delete user"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => {
                    setEditingItem(null)
                    setShowItemModal(true)
                  }}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <h2 className="text-lg font-semibold">All Items ({items.length})</h2>
                  <p className="text-sm text-muted-foreground mt-1">Manage and delete items</p>
                </div>
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Created By</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.serial_number && (
                              <p className="text-xs text-muted-foreground">SN: {item.serial_number}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.category?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <p>{item.location?.name || 'N/A'}</p>
                            {item.location?.path && (
                              <p className="text-xs text-muted-foreground">{item.location.path}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm">{getUserDisplayName(item.created_by_user)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item)
                                setShowItemModal(true)
                              }}
                              className="text-primary hover:underline text-sm"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => prepareDeleteItem(item.id, item.name)}
                              className="text-destructive hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => {
                    setEditingLocation(null)
                    setShowLocationModal(true)
                  }}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Location
                </button>
              </div>

              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <h2 className="text-lg font-semibold">All Locations ({locations.length})</h2>
                  <p className="text-sm text-muted-foreground mt-1">Manage and delete locations</p>
                </div>
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Full Path</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Parent</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {locations.map((location) => (
                      <tr key={location.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{location.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{location.path}</td>
                        <td className="px-4 py-3 text-sm">
                          {location.parent_id ? 'Has parent' : 'Root level'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingLocation(location)
                                setShowLocationModal(true)
                              }}
                              className="text-primary hover:underline text-sm"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => prepareDeleteLocation(location.id, location.name)}
                              className="text-destructive hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => {
                    setEditingCategory(null)
                    setShowCategoryModal(true)
                  }}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div key={category.id} className="bg-card border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {category.icon && <span className="text-2xl">{category.icon}</span>}
                        <span className="font-medium">{category.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category)
                            setShowCategoryModal(true)
                          }}
                          className="text-primary hover:underline text-sm"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => prepareDeleteCategory(category.id, category.name)}
                          className="text-destructive hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-card border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search item name..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-8 py-2 border rounded-md bg-background"
                    />
                    {auditSearchQuery && (
                      <button
                        onClick={() => setAuditSearchQuery('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Action Filter */}
                  <div>
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Actions</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="soft_delete">Soft Delete</option>
                      <option value="restore">Restore</option>
                      <option value="delete">Delete</option>
                    </select>
                  </div>

                  {/* User Filter */}
                  <div>
                    <select
                      value={auditUserFilter}
                      onChange={(e) => setAuditUserFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Users</option>
                      {auditUsers.map(({ id, user }) => (
                        <option key={id} value={id}>
                          {getUserDisplayName(user)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(auditSearchQuery || auditActionFilter !== 'all' || auditUserFilter !== 'all') && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {auditSearchQuery && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Search: "{auditSearchQuery}"
                        <button onClick={() => setAuditSearchQuery('')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {auditActionFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Action: {auditActionFilter}
                        <button onClick={() => setAuditActionFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {auditUserFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        User: {getUserDisplayName(auditUsers.find(({ id }) => id === auditUserFilter)?.user)}
                        <button onClick={() => setAuditUserFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setAuditSearchQuery('')
                        setAuditActionFilter('all')
                        setAuditUserFilter('all')
                      }}
                      className="ml-auto text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Results */}
              {filteredAuditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card border rounded-lg">
                  {auditLogs.length === 0 ? 'No audit logs yet' : 'No logs match your filters'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="bg-card border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${log.action === 'create'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : log.action === 'update'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : log.action === 'soft_delete'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : log.action === 'restore'
                                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                            >
                              {log.action.replace('_', ' ')}
                            </span>
                            <h3 className="font-semibold text-lg">{log.item?.name || 'Unknown Item'}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()} • {getUserDisplayName(log.user)}
                          </p>
                        </div>
                      </div>

                      {log.changes && (
                        <div className="text-sm space-y-3 mt-4 pt-4 border-t">
                          {log.action === 'create' && log.changes.new && (
                            <div>
                              <p className="font-medium text-muted-foreground mb-2">Initial values:</p>
                              <div className="ml-2 space-y-1 bg-muted/30 rounded-lg p-3">
                                {Object.entries(log.changes.new).map(([key, value]) => {
                                  if (['id', 'created_at', 'updated_at', 'created_by', 'deleted_at', 'deleted_by'].includes(key)) return null
                                  return (
                                    <div key={key} className="flex items-start gap-2">
                                      <span className="text-muted-foreground min-w-32">{key}:</span>
                                      <span className="font-medium flex-1">{formatValue(value)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {(log.action === 'update' || log.action === 'soft_delete' || log.action === 'restore') && log.changes.old && log.changes.new && (
                            <div>
                              <p className="font-medium text-muted-foreground mb-2">Changes:</p>
                              <div className="ml-2 space-y-2">
                                {Object.keys(log.changes.new).map((key) => {
                                  if (['id', 'created_at', 'updated_at', 'created_by'].includes(key)) return null
                                  const oldValue = log.changes.old[key]
                                  const newValue = log.changes.new[key]
                                  if (oldValue === newValue) return null
                                  return (
                                    <div key={key} className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                                      <span className="text-muted-foreground min-w-32 font-medium">{key}:</span>
                                      <div className="flex-1 flex items-center gap-2">
                                        <span className="line-through text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                                          {formatValue(oldValue)}
                                        </span>
                                        <span className="text-muted-foreground">→</span>
                                        <span className="text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded">
                                          {formatValue(newValue)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'admin-audit' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-card border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Action Filter */}
                  <div>
                    <select
                      value={adminAuditActionFilter}
                      onChange={(e) => setAdminAuditActionFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Actions</option>
                      <option value="delete_user">Delete User</option>
                      <option value="resend_confirmation">Resend Confirmation</option>
                      <option value="reset_password">Reset Password</option>
                      <option value="update_email">Update Email</option>
                      <option value="delete_location">Delete Location</option>
                      <option value="restore_location">Restore Location</option>
                      <option value="restore_item">Restore Item</option>
                      <option value="restore_category">Restore Category</option>
                      <option value="bulk_delete">Bulk Delete</option>
                    </select>
                  </div>

                  {/* User Filter */}
                  <div>
                    <select
                      value={adminAuditUserFilter}
                      onChange={(e) => setAdminAuditUserFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Users</option>
                      {adminAuditUsers.map(({ id, user }) => (
                        <option key={id} value={id}>
                          {getUserDisplayName(user)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(adminAuditActionFilter !== 'all' || adminAuditUserFilter !== 'all') && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {adminAuditActionFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Action: {adminAuditActionFilter.replace('_', ' ')}
                        <button onClick={() => setAdminAuditActionFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {adminAuditUserFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        User: {getUserDisplayName(adminAuditUsers.find(({ id }) => id === adminAuditUserFilter)?.user)}
                        <button onClick={() => setAdminAuditUserFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setAdminAuditActionFilter('all')
                        setAdminAuditUserFilter('all')
                      }}
                      className="ml-auto text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Results */}
              {filteredAdminAuditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card border rounded-lg">
                  {adminAuditLogs.length === 0 ? 'No administrative actions logged yet' : 'No logs match your filters'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAdminAuditLogs.map((log) => (
                    <div key={log.id} className="bg-card border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-destructive" />
                          <div>
                            <h3 className="font-semibold text-lg">
                              {log.action === 'delete_location' && 'Location Deletion'}
                              {log.action === 'restore_location' && 'Location Restored'}
                              {log.action === 'restore_item' && 'Item Restored'}
                              {log.action === 'restore_category' && 'Category Restored'}
                              {log.action === 'bulk_delete' && 'Bulk Deletion'}
                              {log.action === 'delete_user' && 'User Deletion'}
                              {log.action === 'resend_confirmation' && 'Resend Confirmation Email'}
                              {log.action.includes('reset_password') && 'Password Reset'}
                              {log.action.includes('update_email') && 'Email Update'}
                              {!['delete_location', 'restore_location', 'restore_item', 'restore_category', 'bulk_delete', 'delete_user', 'resend_confirmation'].includes(log.action) && !log.action.includes('reset_password') && !log.action.includes('update_email') && log.action.replace('_', ' ').toUpperCase()}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                            <p className="text-sm font-medium mt-1">
                              Admin: {getUserDisplayName(log.user)}
                            </p>
                            {log.details?.email && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Target: {log.details.email}
                              </p>
                            )}
                            {(log.details?.item_name || log.details?.location_name || log.details?.category_name) && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {log.details?.item_name && `Item: ${log.details.item_name}`}
                                {log.details?.location_name && `Location: ${log.details.location_name}`}
                                {log.details?.category_name && `Category: ${log.details.category_name}`}
                                {log.details?.item_serial_number && ` (SN: ${log.details.item_serial_number})`}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          log.action.startsWith('restore_')
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {log.action.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      {log.action === 'delete_location' && log.details && (
                        <div className="space-y-3 text-sm">
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-muted-foreground mb-1">Location</p>
                                <p className="font-semibold">{log.details.location_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{log.details.location_path}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Deletion Summary</p>
                                <div className="space-y-0.5">
                                  <p className="font-medium">{log.details.total_locations_deleted} locations deleted</p>
                                  <p className="font-medium">{log.details.total_items_deleted} items deleted</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {log.details.deleted_child_locations?.length > 0 && (
                            <div>
                              <p className="font-medium mb-2">Deleted Sub-Locations ({log.details.deleted_child_locations.length})</p>
                              <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                                <ul className="space-y-1.5">
                                  {log.details.deleted_child_locations.map((loc, idx) => (
                                    <li key={idx} className="text-xs">
                                      <span className="font-medium">{loc.name}</span>
                                      <span className="text-muted-foreground ml-2">{loc.path}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {log.details.deleted_items?.length > 0 && (
                            <div>
                              <p className="font-medium mb-2">Deleted Items ({log.details.deleted_items.length})</p>
                              <div className="bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto">
                                <ul className="space-y-1.5">
                                  {log.details.deleted_items.map((item, idx) => (
                                    <li key={idx} className="text-xs">
                                      <span className="font-medium">{item.name}</span>
                                      {item.serial_number && (
                                        <span className="text-muted-foreground ml-2">SN: {item.serial_number}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'deleted' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-card border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={deletedSearchQuery}
                      onChange={(e) => setDeletedSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-8 py-2 border rounded-md bg-background"
                    />
                    {deletedSearchQuery && (
                      <button
                        onClick={() => setDeletedSearchQuery('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Type Filter */}
                  <div>
                    <select
                      value={deletedTypeFilter}
                      onChange={(e) => setDeletedTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Types</option>
                      <option value="items">Items ({deletedItems.length})</option>
                      <option value="locations">Locations ({deletedLocations.length})</option>
                      <option value="categories">Categories ({deletedCategories.length})</option>
                    </select>
                  </div>

                  {/* User Filter */}
                  <div>
                    <select
                      value={deletedUserFilter}
                      onChange={(e) => setDeletedUserFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">All Users</option>
                      {deletedByUsers.map(({ id, user }) => (
                        <option key={id} value={id}>
                          {getUserDisplayName(user)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(deletedSearchQuery || deletedTypeFilter !== 'all' || deletedUserFilter !== 'all') && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {deletedSearchQuery && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Search: "{deletedSearchQuery}"
                        <button onClick={() => setDeletedSearchQuery('')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {deletedTypeFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Type: {deletedTypeFilter}
                        <button onClick={() => setDeletedTypeFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {deletedUserFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        User: {getUserDisplayName(deletedByUsers.find(({ id }) => id === deletedUserFilter)?.user)}
                        <button onClick={() => setDeletedUserFilter('all')} className="hover:text-primary/80">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setDeletedSearchQuery('')
                        setDeletedTypeFilter('all')
                        setDeletedUserFilter('all')
                      }}
                      className="ml-auto text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Deleted Items */}
              {(deletedTypeFilter === 'all' || deletedTypeFilter === 'items') && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Deleted Items ({filteredDeletedItems.length})</h2>
                  {filteredDeletedItems.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-card border rounded-lg">
                      {deletedItems.length === 0 ? 'No deleted items' : 'No items match your filters'}
                    </div>
                  ) : (
                    <div className="bg-card border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted By</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredDeletedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{item.name}</td>
                              <td className="px-4 py-3 text-sm">{item.category?.name || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm">{item.location?.name || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {new Date(item.deleted_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm">{getUserDisplayName(item.deleted_by_user)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => restoreItem(item.id)}
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Deleted Locations */}
              {(deletedTypeFilter === 'all' || deletedTypeFilter === 'locations') && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Deleted Locations ({filteredDeletedLocations.length})</h2>
                  {filteredDeletedLocations.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-card border rounded-lg">
                      {deletedLocations.length === 0 ? 'No deleted locations' : 'No locations match your filters'}
                    </div>
                  ) : (
                    <div className="bg-card border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Path</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted By</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredDeletedLocations.map((location) => (
                            <tr key={location.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{location.name}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{location.path}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {new Date(location.deleted_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm">{getUserDisplayName(location.deleted_by_user)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => restoreLocation(location.id)}
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Deleted Categories */}
              {(deletedTypeFilter === 'all' || deletedTypeFilter === 'categories') && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Deleted Categories ({filteredDeletedCategories.length})</h2>
                  {filteredDeletedCategories.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-card border rounded-lg">
                      {deletedCategories.length === 0 ? 'No deleted categories' : 'No categories match your filters'}
                    </div>
                  ) : (
                    <div className="bg-card border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Icon</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Deleted By</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredDeletedCategories.map((category) => (
                            <tr key={category.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{category.name}</td>
                              <td className="px-4 py-3 text-xl">{category.icon}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {new Date(category.deleted_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm">{getUserDisplayName(category.deleted_by_user)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => restoreCategory(category.id)}
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ItemModal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false)
          setEditingItem(null)
        }}
        onSuccess={fetchData}
        item={editingItem}
      />

      <LocationModal
        isOpen={showLocationModal}
        onClose={() => {
          setShowLocationModal(false)
          setEditingLocation(null)
        }}
        onSuccess={fetchData}
        location={editingLocation}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false)
          setEditingCategory(null)
        }}
        onSuccess={fetchData}
        category={editingCategory}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteModalData.type === 'item' ? 'Item' : deleteModalData.type === 'location' ? 'Location' : 'Category'}`}
        itemName={deleteModalData.name || ''}
        itemType={deleteModalData.type}
        userEmail={currentUser?.email || ''}
        affectedData={deleteModalData.affectedData}
      />

      <RoleChangeConfirmationModal
        isOpen={showRoleChangeModal}
        onClose={() => {
          setShowRoleChangeModal(false)
          setRoleChangeData({ user: null, newRole: null })
        }}
        onConfirm={updateUserRole}
        user={roleChangeData.user}
        newRole={roleChangeData.newRole}
        currentUserEmail={currentUser?.email || ''}
      />
    </div>
  )
}
