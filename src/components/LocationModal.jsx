import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'
import { Upload, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'

export default function LocationModal({ isOpen, onClose, onSuccess, location = null, parentId = null }) {
  const [formData, setFormData] = useState({
    name: '',
    parent_id: parentId || '',
    description: '',
  })
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchLocations()
      if (location) {
        setFormData({
          name: location.name || '',
          parent_id: location.parent_id || '',
          description: location.description || '',
        })
        setImagePreview(location.image_url || null)
      } else {
        setFormData({
          name: '',
          parent_id: parentId || '',
          description: '',
        })
        setImagePreview(null)
      }
      setImageFile(null)
      setError(null)
    }
  }, [isOpen, location, parentId])

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('path')

    // Filter out current location and its children to prevent circular references
    let filteredLocations = data || []
    if (location) {
      filteredLocations = filteredLocations.filter(
        (loc) => loc.id !== location.id && !loc.path?.startsWith(location.path)
      )
    }
    setLocations(filteredLocations)
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

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let imageUrl = location?.image_url || null

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

      const locationData = {
        name: formData.name,
        parent_id: formData.parent_id || null,
        description: formData.description || null,
        image_url: imageUrl,
      }

      if (location) {
        // Update existing location
        const { error: updateError } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', location.id)

        if (updateError) throw updateError
      } else {
        // Create new location
        const { error: insertError } = await supabase
          .from('locations')
          .insert([locationData])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving location:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={location ? 'Edit Location' : 'Add New Location'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
            placeholder="e.g., Main Office, Room 101, Shelf A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background resize-none"
            placeholder="Optional description of this location"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Parent Location</label>
          <select
            value={formData.parent_id}
            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="">None (Top Level)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.path}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to create a top-level location
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location Image</label>
          <div className="mt-2">
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-32 w-32 object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
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
            {loading ? 'Saving...' : location ? 'Update Location' : 'Create Location'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
