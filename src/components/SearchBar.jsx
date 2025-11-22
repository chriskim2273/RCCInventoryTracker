import { useState, memo } from 'react'
import { Search, Sparkles, Download, X } from 'lucide-react'

const SearchBar = memo(({
  onRegularSearch,
  onAiSearch,
  onClearSearch,
  onExportCSV,
  searchLoading,
  useAiSearch,
  activeSearchQuery,
  aiSearchError
}) => {
  const [localInput, setLocalInput] = useState('')
  const [isAiHovered, setIsAiHovered] = useState(false)

  const handleRegularSearch = () => {
    onRegularSearch(localInput)
  }

  const handleAiSearch = () => {
    onAiSearch(localInput)
  }

  const handleClear = () => {
    setLocalInput('')
    onClearSearch()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && localInput.trim()) {
      handleRegularSearch()
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search items..."
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-10 py-2 text-sm sm:text-base border rounded-md bg-background"
        />
        {activeSearchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {aiSearchError && (
          <div className="absolute top-full mt-1 text-xs text-red-600">
            Error: {aiSearchError}
          </div>
        )}
      </div>
      <button
        onClick={handleRegularSearch}
        disabled={searchLoading || !localInput.trim()}
        className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-md transition-colors text-sm sm:text-base whitespace-nowrap ${
          activeSearchQuery && !useAiSearch
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'hover:bg-secondary'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {searchLoading && !useAiSearch ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Search</span>
      </button>
      <button
        onClick={handleAiSearch}
        onMouseEnter={() => setIsAiHovered(true)}
        onMouseLeave={() => setIsAiHovered(false)}
        disabled={searchLoading || !localInput.trim()}
        className={`
          relative overflow-hidden
          flex items-center justify-center gap-2 px-4 py-2 rounded-md
          text-sm sm:text-base whitespace-nowrap
          transition-all duration-300 ease-in-out
          ${
            useAiSearch
              ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-500/50 scale-105'
              : 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 text-white border-0 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105'
          }
          ${searchLoading || !localInput.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          group
        `}
        style={{
          boxShadow: useAiSearch
            ? '0 0 30px rgba(168, 85, 247, 0.4), 0 0 60px rgba(168, 85, 247, 0.2)'
            : isAiHovered
              ? '0 0 25px rgba(168, 85, 247, 0.3)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Animated shimmer effect */}
        <div
          className={`
            absolute inset-0
            bg-gradient-to-r from-transparent via-white/20 to-transparent
            ${isAiHovered || useAiSearch ? 'animate-shimmer' : ''}
          `}
        />

        {/* Content */}
        <div className="relative flex items-center gap-2">
          {searchLoading && useAiSearch ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles
              className={`h-4 w-4 transition-transform duration-300 ${
                isAiHovered || useAiSearch ? 'rotate-12 scale-110' : ''
              }`}
            />
          )}
          <span className="hidden sm:inline font-medium">AI Search</span>
          <span className="sm:hidden font-medium">AI</span>
        </div>

        {/* Pulsing ring effect when active */}
        {useAiSearch && (
          <div className="absolute inset-0 rounded-md animate-pulse bg-purple-400/20" />
        )}
      </button>
      <button
        onClick={onExportCSV}
        className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-secondary transition-colors text-sm sm:text-base whitespace-nowrap"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">Export</span>
      </button>
    </div>
  )
})

SearchBar.displayName = 'SearchBar'

export default SearchBar
