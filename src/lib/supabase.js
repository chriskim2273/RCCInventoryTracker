import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch all rows from a query, paginating past Supabase's 1000-row default limit.
 * Pass a Supabase query builder (before awaiting) and get back { data, error }.
 */
export async function fetchAllRows(queryBuilder, pageSize = 1000) {
  let allData = []
  let from = 0

  while (true) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return { data: allData, error: null }
}
