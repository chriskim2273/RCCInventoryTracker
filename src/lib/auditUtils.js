export async function fetchAuditItems(client, logs) {
  const itemIds = [...new Set(logs.map(log => log.item_id).filter(Boolean))]
  if (itemIds.length === 0) return new Map()

  // Audit pages contain at most 50 logs, so this lookup stays below the API row cap.
  const { data, error } = await client
    .from('items')
    .select('id, name')
    .in('id', itemIds)

  if (error) throw error
  return new Map((data || []).map(item => [item.id, item]))
}

export function getAuditItemName(log) {
  return log.item?.name || log.changes?.new?.name || log.changes?.old?.name || 'Unknown Item'
}
