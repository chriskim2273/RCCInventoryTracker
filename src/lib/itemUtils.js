import { supabase } from './supabase'

/**
 * Calculate the available quantity for an item based on active checkouts
 * @param {Object} item - The item object with id and quantity
 * @param {Array} activeCheckouts - Optional array of active checkout logs
 * @returns {Promise<Object>} - Object with availableQuantity, checkedOutQuantity, and activeCheckouts
 */
export async function calculateItemAvailability(item, activeCheckouts = null) {
  if (!item) {
    return { availableQuantity: 0, checkedOutQuantity: 0, activeCheckouts: [] }
  }

  // Fetch active checkouts if not provided
  if (!activeCheckouts) {
    const { data } = await supabase
      .from('checkout_logs')
      .select('*')
      .eq('item_id', item.id)
      .is('checked_in_at', null)

    activeCheckouts = data || []
  }

  // Calculate total checked out quantity (only counting what hasn't been returned)
  const checkedOutQuantity = activeCheckouts.reduce((sum, log) => {
    const checkedOut = log.quantity_checked_out || 0
    const checkedIn = log.quantity_checked_in || 0
    return sum + (checkedOut - checkedIn)
  }, 0)

  const availableQuantity = Math.max(0, (item.quantity || 0) - checkedOutQuantity)

  return {
    availableQuantity,
    checkedOutQuantity,
    activeCheckouts,
    totalQuantity: item.quantity || 0,
  }
}

/**
 * Get the status of an item based on its availability
 * @param {Object} item - The item object
 * @param {number} availableQuantity - Available quantity
 * @param {number} checkedOutQuantity - Checked out quantity
 * @returns {string} - Status: 'out_of_stock', 'fully_checked_out', 'partially_available', 'available'
 */
export function getItemStatus(item, availableQuantity, checkedOutQuantity) {
  const totalQuantity = item.quantity || 0

  if (totalQuantity === 0) {
    return 'out_of_stock'
  }

  if (checkedOutQuantity === 0) {
    return 'available'
  }

  if (availableQuantity === 0) {
    return 'fully_checked_out'
  }

  return 'partially_available'
}

/**
 * Format the status text for display
 * @param {string} status - Status from getItemStatus
 * @param {number} availableQuantity - Available quantity
 * @param {number} totalQuantity - Total quantity
 * @returns {string} - Formatted status text
 */
export function formatItemStatus(status, availableQuantity, totalQuantity) {
  switch (status) {
    case 'out_of_stock':
      return 'Out of Stock'
    case 'fully_checked_out':
      return 'Fully Checked Out'
    case 'partially_available':
      return `${availableQuantity} of ${totalQuantity} Available`
    case 'available':
      return 'Available'
    default:
      return 'Unknown'
  }
}
