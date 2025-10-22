import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import { Upload, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'

export default function ItemModal({ isOpen, onClose, onSuccess, item = null, locationId = null }) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    serial_number: '',
    quantity: 1,
    category_id: '',
    location_id: locationId || '',
    description: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchOptions()
      if (item) {
        setFormData({
          name: item.name || '',
          brand: item.brand || '',
          serial_number: item.serial_number || '',
          quantity: item.quantity || 1,
          category_id: item.category_id || '',
          location_id: item.location_id || '',
          description: item.description || '',
        })
        setImagePreview(item.image_url || null)
      } else {
        setFormData({
          name: '',
          brand: '',
          serial_number: '',
          quantity: 1,
          category_id: '',
          location_id: locationId || '',
          description: '',
        })
        setImagePreview(null)
      }
      setImageFile(null)
      setError(null)
    }
  }, [isOpen, item, locationId])

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
      let imageUrl = item?.image_url || null

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
      }

      const itemData = {
        ...formData,
        image_url: imageUrl,
        quantity: parseInt(formData.quantity),
      }

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Item' : 'Add New Item'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
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
            <label className="block text-sm font-medium mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
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
  )
}
