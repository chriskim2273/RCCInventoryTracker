/**
 * AI-powered search using OpenRouter
 * Minimizes token usage by sending only essential item data
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// List of free models to try (in order of preference)
const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'x-ai/grok-4.1-fast:free',
  'mistralai/mistral-7b-instruct:free',
]

/**
 * Try a single model
 */
async function tryModelSearch(model, apiKey, minimalItems, searchQuery) {
  const systemPrompt = `You are a search assistant. Return ONLY a JSON array of item IDs that match the search query. No explanation, just the array.`

  const userPrompt = `Items: ${JSON.stringify(minimalItems)}

Search query: "${searchQuery}"

Return matching item IDs as JSON array: ["id1", "id2", ...]`

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: model.includes('free') ? null : 1000,
  }

  console.log(`[AI Search] Trying model: ${model}`)
  const startTime = performance.now()

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify(requestBody),
  })

  const endTime = performance.now()
  console.log(`[AI Search] Model ${model} responded in ${(endTime - startTime).toFixed(2)}ms with status ${response.status}`)

  const data = await response.json()

  if (!response.ok) {
    console.error(`[AI Search] Model ${model} failed:`, data)
    throw new Error(data.error?.message || `Model ${model} failed`)
  }

  console.log(`[AI Search] Model ${model} full response:`, data)
  return data
}

/**
 * Search items using AI
 * @param {Array} items - Array of item objects
 * @param {string} searchQuery - User's search query
 * @returns {Promise<Array>} Array of matching item IDs
 */
export async function aiSearch(items, searchQuery) {
  console.log('[AI Search] Starting search...')
  console.log('[AI Search] Query:', searchQuery)
  console.log('[AI Search] Total items to search:', items.length)

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    console.error('[AI Search] API key not configured')
    throw new Error('OpenRouter API key not configured')
  }

  if (!searchQuery || !searchQuery.trim()) {
    console.log('[AI Search] Empty search query, returning empty array')
    return []
  }

  // Minimize token usage - only send essential fields
  const minimalItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    model: item.model,
  }))

  console.log('[AI Search] Prepared minimal items:', minimalItems.length)
  console.log('[AI Search] Sample item:', minimalItems[0])
  console.log('[AI Search] Estimated prompt size:', JSON.stringify(minimalItems).length, 'characters')

  // Try each model in sequence until one succeeds
  let lastError = null

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i]
    try {
      console.log(`[AI Search] Attempt ${i + 1}/${FALLBACK_MODELS.length}: Using model ${model}`)

      const data = await tryModelSearch(model, apiKey, minimalItems, searchQuery)

      const content = data.choices[0]?.message?.content
      console.log('[AI Search] Raw LLM response:', content)

      if (!content) {
        console.warn('[AI Search] No content in response, trying next model...')
        lastError = new Error('No content in response')
        continue
      }

      // Parse the JSON array from response
      // Handle potential markdown code blocks
      let jsonStr = content.trim()
      console.log('[AI Search] Trimmed response:', jsonStr)

      if (jsonStr.startsWith('```')) {
        console.log('[AI Search] Response has markdown code blocks, removing...')
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
        console.log('[AI Search] Cleaned response:', jsonStr)
      }

      console.log('[AI Search] Parsing JSON...')
      let matchingIds
      try {
        matchingIds = JSON.parse(jsonStr)
      } catch (parseError) {
        console.error('[AI Search] JSON parsing failed:', parseError.message)

        // Check if this is an unterminated string error (response too long)
        if (parseError.message.includes('Unterminated string') ||
            parseError.message.includes('Unexpected end of JSON')) {
          console.error('[AI Search] Response appears truncated - query too generic')
          throw new Error('Your search query is too generic and matches too many items. Please be more specific (e.g., include brand, model, or category).')
        }

        // Other JSON parsing errors
        lastError = parseError
        continue
      }

      console.log('[AI Search] Parsed result:', matchingIds)

      // Validate response is an array
      if (!Array.isArray(matchingIds)) {
        console.error('[AI Search] Response is not an array:', matchingIds)
        console.error('[AI Search] Response type:', typeof matchingIds)
        lastError = new Error('Response is not an array')
        continue
      }

      console.log(`[AI Search] Success with model ${model}! Found ${matchingIds.length} matching items`)
      console.log('[AI Search] Matching IDs:', matchingIds)

      return matchingIds
    } catch (error) {
      console.error(`[AI Search] Model ${model} failed:`, error.message)
      lastError = error

      // If error is about query being too generic, stop trying other models
      if (error.message.includes('too generic')) {
        console.error('[AI Search] Stopping fallback attempts - query too generic')
        throw error
      }

      // If this isn't the last model, continue to next one
      if (i < FALLBACK_MODELS.length - 1) {
        console.log('[AI Search] Trying next fallback model...')
        continue
      }
    }
  }

  // All models failed
  console.error('[AI Search] All models failed. Last error:', lastError)
  throw new Error(lastError?.message || 'All AI models failed. Try again later or use regular search.')
}
