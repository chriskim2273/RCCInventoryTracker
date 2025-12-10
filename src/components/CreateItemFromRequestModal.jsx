import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import LocationPicker from './LocationPicker'
import { Upload, X, Package } from 'lucide-react'
import imageCompression from 'browser-image-compression'

/**
 * Modal for creating an inventory item from a delivered reorder request.
 * Pre-fills form data from the request details and uses LocationPicker
 * for hierarchical location selection.
 */
export default function CreateItemFromRequestModal({
  isOpen,
  onClose,
  onSuccess,
  request
}) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    stony_brook_asset_tag: '',
    quantity: 1,
    min_quantity: '',
    category_id: '',
    location_id: '',
    description: '',
    order_link: '',
  })
  const [unknownQuantity, setUnknownQuantity] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && request) {
      fetchOptions()

      // Calculate total quantity from request
      const quantity = request.quantity_to_order * (request.units_per_pack || 1)

      // Pre-fill form data from the request
      setFormData({
        name: request.item_name || '',
        brand: request.item_brand || '',
        model: request.item_model || '',
        serial_number: '',
        stony_brook_asset_tag: '',
        quantity: quantity,
        min_quantity: '',
        category_id: request.item_category_id || '',
        location_id: request.location_id || '', // Start with center, user can drill down
        description: '',
        order_link: request.order_link || '',
      })
      setUnknownQuantity(false)
      setImageFile(null)
      setImagePreview(null)
      setError(null)
    }
  }, [isOpen, request])

  const fetchOptions = async () => {
    const [categoriesRes, locationsRes] = await Promise.all([
      supabase.from('categories').select('*').is('deleted_at', null).order('name'),
      supabase.from('locations').select('*').is('deleted_at', null).order('path'),
    ])
    setCategories(categoriesRes.data || [])
    setLocations(locationsRes.data || [])
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg'
        }

        const compressedFile = await imageCompression(file, options)
        const fileToUse = compressedFile.size < file.size ? compressedFile : file

        setImageFile(fileToUse)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result)
        }
        reader.readAsDataURL(fileToUse)
      } catch (error) {
        console.error('Error compressing image:', error)
        setError('Failed to compress image. Using original.')
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (!formData.name?.trim()) {
        throw new Error('Item name is required')
      }
      if (!formData.category_id) {
        throw new Error('Category is required')
      }
      if (!formData.location_id) {
        throw new Error('Location is required')
      }

      let imageUrl = null

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      // Create the item
      const itemData = {
        name: formData.name,
        brand: formData.brand || null,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        stony_brook_asset_tag: formData.stony_brook_asset_tag || null,
        quantity: unknownQuantity ? null : parseInt(formData.quantity),
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
        category_id: formData.category_id,
        location_id: formData.location_id,
        description: formData.description || null,
        order_link: formData.order_link || null,
        image_url: imageUrl,
        created_by: user.id,
        created_by_name: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.email,
      }

      const { data: newItem, error: insertError } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single()

      if (insertError) throw insertError

      // Update the reorder request to link to the new item and mark as documented
      const { error: updateError } = await supabase
        .from('reorder_requests')
        .update({
          item_id: newItem.id,
          status: 'documented',
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error creating item from request:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryDisplay = () => {
    const cat = categories.find(c => c.id === formData.category_id)
    return cat ? `${cat.icon} ${cat.name}` : 'No category'
  }

  if (!request) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Item from Request"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Creating inventory item from order request</p>
            <p className="text-muted-foreground mt-1">
              The fields below are pre-filled from the order request. Adjust as needed before creating the item.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Stony Brook Asset Tag</label>
            <input
              type="text"
              value={formData.stony_brook_asset_tag}
              onChange={(e) => setFormData({ ...formData, stony_brook_asset_tag: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  required={!unknownQuantity}
                  disabled={unknownQuantity}
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={unknownQuantity}
                  onChange={(e) => setUnknownQuantity(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Unknown</span>
              </label>
            </div>
            {request.units_per_pack && request.units_per_pack > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Pre-filled: {request.quantity_to_order} packs x {request.units_per_pack} units = {request.quantity_to_order * request.units_per_pack} total
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-orange-700 dark:text-orange-400">Min Quantity Warning</label>
            <input
              type="number"
              min="0"
              placeholder="Optional"
              value={formData.min_quantity}
              onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
              className="w-full px-3 py-2 border-2 border-orange-300 dark:border-orange-700 rounded-md bg-background focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900"
            />
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Alert when quantity falls below this level
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category *</label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Location *</label>
            <LocationPicker
              locations={locations}
              value={formData.location_id}
              onChange={(locationId) => setFormData({ ...formData, location_id: locationId })}
              required
              placeholder="Select location..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select the specific location where this item will be stored
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            rows="3"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Order Link</label>
          <input
            type="url"
            placeholder="https://..."
            value={formData.order_link}
            onChange={(e) => setFormData({ ...formData, order_link: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            URL for ordering this item (optional)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Image</label>
          <div className="flex items-start gap-4">
            {imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-md border" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null)
                    setImageFile(null)
                  }}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-xs text-muted-foreground">Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
