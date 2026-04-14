import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import Modal from './Modal'

// Update this version when adding new changelog entries
const CHANGELOG_VERSION = '1.9.0'
const STORAGE_KEY = `changelog_dismissed_v${CHANGELOG_VERSION}`

// Changelog entries - add new versions at the top
const CHANGELOG_ENTRIES = [
  {
    version: '1.9.0',
    date: '2026-04-13',
    title: 'AI Search & Audit Log Fixes',
    changes: [
      'Fixed AI Search using the previous query instead of the current search bar text',
      'AI Search now cancels in-flight requests when starting a new search, preventing stale results',
      'AI Search now includes item description and category for more accurate results',
      'AI Search splits large inventories into parallel chunks for faster results and shows a progress bar',
      'AI Search retries failed requests automatically with exponential backoff',
      'Fixed soft delete and restore actions being logged as generic "update" in audit logs',
      'Fixed role changes silently failing to write to audit logs',
      'Admin Panel audit tab now consolidates consecutive edits by the same user within 5 minutes',
      'Bulk delete and bulk move operations now create admin audit log entries',
      'Added Bulk Delete, Bulk Move, and Role Change filters to admin audit tab',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-03-08',
    title: 'Pagination',
    changes: [
      'All item lists now load 50 items per page with page navigation controls, improving performance for large inventories',
      'Items page uses server-side pagination for fast browsing, with automatic client-side fallback when using fuzzy search or AI search',
      'Location Explorer items are now paginated with server-side queries',
      'Reorder Requests page now paginates results across all filters and sorting',
      'Admin Panel deleted items, checkout history, and admin comments tabs now paginate their lists',
      'Inventory no longer stops at 1,000 items — all records are accessible via pagination',
    ],
  },
  {
    version: '1.7.6',
    date: '2026-02-09',
    title: 'Mobile Check-In & Location Path Fixes',
    changes: [
      'Check In and Check Out buttons are now easily accessible on mobile devices at the top of the item detail page',
      'Renaming a location now correctly updates the full path for all child and grandchild locations',
      'Fixed stale location paths appearing in search results after a location rename',
    ],
  },
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

const ChangelogEntry = ({ entry }) => (
  <div className="space-y-3">
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
)

export default function ChangelogModal({ isOpen, onClose }) {
  const [showHistory, setShowHistory] = useState(false)
  const [latest, ...older] = CHANGELOG_ENTRIES

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="What's New" size="md">
      <div className="space-y-6">
        <ChangelogEntry entry={latest} />

        {older.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Previous updates ({older.length})
            </button>
            {showHistory && (
              <div className="space-y-6 mt-4">
                {older.map((entry) => (
                  <ChangelogEntry key={entry.version} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}

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
