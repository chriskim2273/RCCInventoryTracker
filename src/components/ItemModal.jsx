import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import RelocationConfirmationModal from './RelocationConfirmationModal'
import { Upload, X, AlertTriangle } from 'lucide-react'
import imageCompression from 'browser-image-compression'

export default function ItemModal({ isOpen, onClose, onSuccess, item = null, locationId = null }) {
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
    location_id: locationId || '',
    description: '',
  })
  const [unknownQuantity, setUnknownQuantity] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [showRelocationModal, setShowRelocationModal] = useState(false)
  const [originalLocationId, setOriginalLocationId] = useState(null)
  const [pendingUpdateData, setPendingUpdateData] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchOptions()
      if (item) {
        const isQuantityUnknown = item.quantity === null
        setFormData({
          name: item.name || '',
          brand: item.brand || '',
          model: item.model || '',
          serial_number: item.serial_number || '',
          stony_brook_asset_tag: item.stony_brook_asset_tag || '',
          quantity: item.quantity || 1,
          min_quantity: item.min_quantity || '',
          category_id: item.category_id || '',
          location_id: item.location_id || '',
          description: item.description || '',
        })
        setUnknownQuantity(isQuantityUnknown)
        setImagePreview(item.image_url || null)
        setOriginalLocationId(item.location_id || null)
      } else {
        setFormData({
          name: '',
          brand: '',
          model: '',
          serial_number: '',
          stony_brook_asset_tag: '',
          quantity: 1,
          min_quantity: '',
          category_id: '',
          location_id: locationId || '',
          description: '',
        })
        setUnknownQuantity(false)
        setImagePreview(null)
        setOriginalLocationId(null)
      }
      setImageFile(null)
      setError(null)
      setDuplicateWarning(null)
      setShowRelocationModal(false)
      setPendingUpdateData(null)
    }
  }, [isOpen, item, locationId])

  // Check for duplicate names in the same location
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!formData.name || !formData.location_id) {
        setDuplicateWarning(null)
        return
      }

      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, name, serial_number')
          .eq('name', formData.name)
          .eq('location_id', formData.location_id)
          .is('deleted_at', null)

        if (error) throw error

        // Filter out the current item if we're editing
        const duplicates = data?.filter(d => d.id !== item?.id) || []

        if (duplicates.length > 0) {
          setDuplicateWarning({
            count: duplicates.length,
            items: duplicates
          })
        } else {
          setDuplicateWarning(null)
        }
      } catch (err) {
        console.error('Error checking for duplicates:', err)
      }
    }

    // Debounce the check
    const timer = setTimeout(checkDuplicate, 500)
    return () => clearTimeout(timer)
  }, [formData.name, formData.location_id, item?.id])

  const fetchOptions = async () => {
    const [categoriesRes, locationsRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('locations').select('*').order('path'),
    ])
    setCategories(categoriesRes.data || [])
    setLocations(locationsRes.data || [])
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      try {
        // Compress the image
        const options = {
          maxSizeMB: 1,          // Maximum file size in MB
          maxWidthOrHeight: 1920, // Maximum width or height
          useWebWorker: true,     // Use web worker for better performance
          fileType: 'image/jpeg'  // Convert to JPEG for better compression
        }

        const compressedFile = await imageCompression(file, options)

        // Use the smaller file (compressed or original)
        const fileToUse = compressedFile.size < file.size ? compressedFile : file

        setImageFile(fileToUse)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result)
        }
        reader.readAsDataURL(fileToUse)

        // Log compression results
        console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)
        if (compressedFile.size < file.size) {
          console.log(`Using compressed (${(((file.size - compressedFile.size) / file.size) * 100).toFixed(2)}% reduction)`)
        } else {
          console.log(`Using original (compressed was larger)`)
        }
      } catch (error) {
        console.error('Error compressing image:', error)
        setError('Failed to compress image. Using original.')
        // Fallback to original file
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
      let imageUrl = null

      // Upload image if new file selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const { error: uploadError, data } = await supabase.storage
          .from('item-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      } else if (imagePreview) {
        // Keep existing image if preview is showing (user didn't remove it)
        imageUrl = item?.image_url || null
      }
      // else: imageUrl stays null (user removed the image)

      const itemData = {
        ...formData,
        image_url: imageUrl,
        quantity: unknownQuantity ? null : parseInt(formData.quantity),
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
      }

      // Check if we're editing an item and the location has changed
      if (item && originalLocationId !== formData.location_id) {
        // Store the pending update data and show confirmation modal
        setPendingUpdateData(itemData)
        setShowRelocationModal(true)
        setLoading(false)
        return
      }

      // Proceed with update/insert if no location change or creating new item
      if (item) {
        // Update existing item (don't update created_by)
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id)

        if (updateError) throw updateError
      } else {
        // Create new item (include created_by)
        const { error: insertError } = await supabase
          .from('items')
          .insert([{
            ...itemData,
            created_by: user.id,
            created_by_name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email,
          }])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving item:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const confirmRelocation = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('items')
        .update(pendingUpdateData)
        .eq('id', item.id)

      if (updateError) throw updateError

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error relocating item:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Item' : 'Add New Item'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {duplicateWarning && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-md text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Duplicate Name Warning</p>
                  <p className="mt-1">
                    {duplicateWarning.count} other item{duplicateWarning.count > 1 ? 's' : ''} with the name "{formData.name}" already exist{duplicateWarning.count === 1 ? 's' : ''} in this location:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {duplicateWarning.items.map((item) => (
                      <li key={item.id} className="ml-4">
                        • {item.name}{item.serial_number ? ` (SN: ${item.serial_number})` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    You can still proceed, but consider using a unique serial number or different name to distinguish this item.
                  </p>
                </div>
              </div>
            </div>
          )}

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

            <div className="md:col-span-2">
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

            <div>
              <label className="block text-sm font-medium mb-1">Location *</label>
              <select
                required
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.path}
                  </option>
                ))}
              </select>
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

          <div className="flex justify-end gap-2 pt-4">
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
              {loading ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>

      <RelocationConfirmationModal
        isOpen={showRelocationModal}
        onClose={() => setShowRelocationModal(false)}
        onConfirm={confirmRelocation}
        item={item}
        currentLocation={locations.find(loc => loc.id === originalLocationId)}
        targetLocation={locations.find(loc => loc.id === formData.location_id)}
      />
    </>
  )
}
