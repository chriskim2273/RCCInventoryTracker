/**
 * AI-powered search using OpenRouter
 * Splits large inventories into parallel chunks for speed and reliability
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

const FALLBACK_MODELS = [
  'openrouter/free',
]

// Items per chunk — keeps each prompt under ~25K chars
const CHUNK_SIZE = 200

// Rate limiting — respect free-tier limits
const CONCURRENT_LIMIT = 3
const BATCH_DELAY_MS = 1200

// Retry config
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

/**
 * Sleep that aborts early if the signal fires
 */
function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

/**
 * Send a single search request to the model
 */
async function searchChunk(model, apiKey, minimalItems, searchQuery, signal) {
  const systemPrompt = `You are an inventory search assistant. Given a list of items and a search query, return ONLY a JSON array of item IDs that match the query. Consider name, brand, model, description, and category when matching. Be generous with partial matches and semantic similarity. Return ONLY the JSON array, no explanation.`

  const userPrompt = `Items:
${JSON.stringify(minimalItems)}

Search query: "${searchQuery}"

Return matching item IDs as a JSON array: ["id1", "id2", ...]
If nothing matches, return: []`

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: model.includes('free') ? null : 1000,
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify(requestBody),
    signal,
  })

  const data = await response.json()

  if (!response.ok) {
    const err = new Error(data.error?.message || `Model ${model} failed`)
    err.status = response.status
    throw err
  }

  return data
}

/**
 * Search a chunk with retry logic
 */
async function searchChunkWithRetry(model, apiKey, chunk, searchQuery, signal, chunkIdx, totalChunks) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const data = await searchChunk(model, apiKey, chunk, searchQuery, signal)
      const content = data.choices[0]?.message?.content
      const ids = parseResponse(content)
      console.log(`[AI Search] Chunk ${chunkIdx + 1}/${totalChunks}: found ${ids.length} matches`)
      return ids
    } catch (error) {
      if (error.name === 'AbortError') throw error
      if (error.message.includes('too generic')) throw error

      const isRetryable = error.status === 429 || error.status >= 500 || error.message.includes('fetch')
      const hasRetriesLeft = attempt < MAX_RETRIES

      if (isRetryable && hasRetriesLeft) {
        const delay = error.status === 429
          ? RETRY_DELAY_MS * (attempt + 2) // Longer backoff for rate limits
          : RETRY_DELAY_MS * (attempt + 1)
        console.warn(`[AI Search] Chunk ${chunkIdx + 1} attempt ${attempt + 1} failed (${error.message}), retrying in ${delay}ms...`)
        await abortableSleep(delay, signal)
        continue
      }

      console.error(`[AI Search] Chunk ${chunkIdx + 1} failed after ${attempt + 1} attempts:`, error.message)
      return []
    }
  }
  return []
}

/**
 * Parse the LLM response into an array of IDs
 */
function parseResponse(content) {
  if (!content) throw new Error('No content in response')

  let jsonStr = content.trim()

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
  }

  let matchingIds
  try {
    matchingIds = JSON.parse(jsonStr)
  } catch (parseError) {
    if (parseError.message.includes('Unterminated string') ||
        parseError.message.includes('Unexpected end of JSON')) {
      throw new Error('Your search query is too generic and matches too many items. Please be more specific (e.g., include brand, model, or category).')
    }
    throw parseError
  }

  if (!Array.isArray(matchingIds)) {
    throw new Error('Response is not an array')
  }

  return matchingIds
}

/**
 * Search items using AI — automatically chunks large inventories
 * @param {Array} items - Array of item objects
 * @param {string} searchQuery - User's search query
 * @param {Object} [options] - Options
 * @param {AbortSignal} [options.signal] - AbortController signal
 * @param {Function} [options.onProgress] - Progress callback ({ completed, total })
 * @returns {Promise<Array>} Array of matching item IDs
 */
export async function aiSearch(items, searchQuery, options = {}) {
  const { signal, onProgress } = options

  console.log('[AI Search] Starting search...')
  console.log('[AI Search] Query:', searchQuery)
  console.log('[AI Search] Total items to search:', items.length)

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw new Error('OpenRouter API key not configured')
  }

  if (!searchQuery || !searchQuery.trim()) {
    return []
  }

  // Build minimal item data for the prompt
  const minimalItems = items.map((item) => {
    const entry = { id: item.id, name: item.name }
    if (item.brand) entry.brand = item.brand
    if (item.model) entry.model = item.model
    if (item.description) entry.desc = item.description
    if (item.category?.name) entry.cat = item.category.name
    return entry
  })

  // Split into chunks
  const chunks = []
  for (let i = 0; i < minimalItems.length; i += CHUNK_SIZE) {
    chunks.push(minimalItems.slice(i, i + CHUNK_SIZE))
  }

  console.log(`[AI Search] Split ${minimalItems.length} items into ${chunks.length} chunks of ~${CHUNK_SIZE}`)
  onProgress?.({ completed: 0, total: chunks.length })

  const model = FALLBACK_MODELS[0]
  const startTime = performance.now()
  const allResults = []
  let completedChunks = 0

  for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENT_LIMIT) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const batch = chunks.slice(batchStart, batchStart + CONCURRENT_LIMIT)

    const batchPromises = batch.map(async (chunk, localIdx) => {
      const globalIdx = batchStart + localIdx
      const ids = await searchChunkWithRetry(model, apiKey, chunk, searchQuery, signal, globalIdx, chunks.length)
      completedChunks++
      onProgress?.({ completed: completedChunks, total: chunks.length })
      return ids
    })

    const batchResults = await Promise.all(batchPromises)
    allResults.push(...batchResults)

    // Delay before next batch to stay under rate limit
    const hasMore = batchStart + CONCURRENT_LIMIT < chunks.length
    if (hasMore) {
      await abortableSleep(BATCH_DELAY_MS, signal)
    }
  }

  const allMatchingIds = allResults.flat()
  const elapsed = (performance.now() - startTime).toFixed(0)

  console.log(`[AI Search] Done in ${elapsed}ms — ${allMatchingIds.length} total matches across ${chunks.length} chunks`)

  return allMatchingIds
}
