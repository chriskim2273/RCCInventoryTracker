import { Sparkles } from 'lucide-react'
import Modal from './Modal'

// Update this version when adding new changelog entries
const CHANGELOG_VERSION = '1.7.5'
const STORAGE_KEY = `changelog_dismissed_v${CHANGELOG_VERSION}`

// Changelog entries - add new versions at the top
const CHANGELOG_ENTRIES = [
  {
    version: '1.7.5',
    date: '2026-01-30',
    title: 'Location Filtering & Bug Fixes',
    changes: [
      'New toggle in Location Explorer to show only items stored directly in that location, excluding items from sublocations',
      'Fixed admin panel issues where deleting comments and location images would not save properly',
      'Improved restore functionality for deleted items with better error messages',
      'Location dropdowns throughout the app now refresh immediately after renaming a location',
      'Deleted items tables now scroll horizontally on mobile devices instead of overflowing',
    ],
  },
]

export default function ChangelogModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="What's New" size="md">
      <div className="space-y-6">
        {CHANGELOG_ENTRIES.map((entry) => (
          <div key={entry.version} className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Version {entry.version}</span>
              <span className="text-sm text-muted-foreground">({entry.date})</span>
            </div>
            {entry.title && (
              <h3 className="font-medium text-lg">{entry.title}</h3>
            )}
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {entry.changes.map((change, idx) => (
                <li key={idx}>{change}</li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Got it!
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Export for use in Layout.jsx
export { CHANGELOG_VERSION, STORAGE_KEY }
