import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

const EMOJI_CATEGORIES = {
  'Common': ['💻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '📞', '📷', '📹', '🎥'],
  'Office': ['📝', '📄', '📊', '📈', '📋', '📌', '✏️', '🖊️', '📁', '📂'],
  'Tech': ['🔌', '🔋', '💾', '💿', '📀', '🎮', '🕹️', '🎧', '🎙️', '📡'],
  'Tools': ['🔧', '🔨', '⚙️', '🛠️', '⚡', '🔩', '🪛', '🔑', '🗝️', '🔒'],
  'Medical': ['💊', '💉', '🩺', '🩹', '🧬', '🔬', '🧪', '⚕️', '🏥', '🚑'],
  'Sports': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '⛳', '🎯'],
  'Objects': ['📦', '📮', '🗑️', '🔖', '🏷️', '💡', '🕯️', '🧰', '🧳', '🎒'],
}

export default function CategoryModal({ isOpen, onClose, onSuccess, category = null }) {
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          name: category.name || '',
          icon: category.icon || '',
        })
      } else {
        setFormData({
          name: '',
          icon: '',
        })
      }
      setError(null)
      setShowEmojiPicker(false)
    }
  }, [isOpen, category])

  const selectEmoji = (emoji) => {
    setFormData({ ...formData, icon: emoji })
    setShowEmojiPicker(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (category) {
        // Update existing category
        const { error: updateError } = await supabase
          .from('categories')
          .update(formData)
          .eq('id', category.id)

        if (updateError) throw updateError
      } else {
        // Create new category
        const { error: insertError } = await supabase
          .from('categories')
          .insert([formData])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving category:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Edit Category' : 'Add New Category'}>
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
            placeholder="e.g., Laptops, Mice, Monitors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Icon (Emoji)</label>

          <div className="space-y-3">
            {/* Current Selection Display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Type or select an emoji"
                  maxLength="2"
                />
              </div>
              {formData.icon && (
                <div className="text-4xl">{formData.icon}</div>
              )}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="px-4 py-2 border rounded-md hover:bg-secondary transition-colors"
              >
                {showEmojiPicker ? 'Hide' : 'Pick'} Emoji
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
                {Object.entries(EMOJI_CATEGORIES).map(([categoryName, emojis]) => (
                  <div key={categoryName} className="mb-4 last:mb-0">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      {categoryName}
                    </h4>
                    <div className="grid grid-cols-10 gap-2">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => selectEmoji(emoji)}
                          className={`text-2xl p-2 rounded-md hover:bg-primary/10 transition-colors ${
                            formData.icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : ''
                          }`}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Optional emoji to display with the category
          </p>
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
            {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
