import { supabase } from './supabase'

/**
 * Base function to call Supabase Edge Functions with authentication
 */
async function callEdgeFunction(functionName, body = {}) {
  // Get the current session token
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`

  console.log('Calling Edge Function:', functionName)
  console.log('Function URL:', functionUrl)
  console.log('Has session:', !!session)
  console.log('Has access token:', !!session?.access_token)

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  console.log('Response status:', response.status)
  console.log('Response data:', data)

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

/**
 * Delete a user from Supabase Auth and the database
 * @param {string} userId - The ID of the user to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteUser(userId) {
  return callEdgeFunction('delete-user', { userId })
}

/**
 * Resend confirmation email to a user
 * @param {string} email - The email address to send the confirmation to
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resendConfirmationEmail(email) {
  return callEdgeFunction('resend-confirmation', { email })
}

/**
 * Get detailed user information including auth status
 * @returns {Promise<{users: Array}>}
 */
export async function getUserDetails() {
  return callEdgeFunction('get-user-details')
}

/**
 * Update user metadata (email, password, ban status)
 * @param {string} userId - The ID of the user to update
 * @param {Object} options - Update options
 * @param {string} [options.email] - New email address
 * @param {boolean} [options.emailConfirm] - Whether to require email confirmation (default: true)
 * @param {string} [options.password] - New password
 * @param {number} [options.banDuration] - Ban duration in hours (0 to unban)
 * @returns {Promise<{success: boolean, message: string, user: Object}>}
 */
export async function updateUserMetadata(userId, options) {
  return callEdgeFunction('update-user-metadata', { userId, ...options })
}

/**
 * Reset a user's password
 * @param {string} userId - The ID of the user
 * @param {string} newPassword - The new password
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetUserPassword(userId, newPassword) {
  return updateUserMetadata(userId, { password: newPassword })
}

/**
 * Update a user's email
 * @param {string} userId - The ID of the user
 * @param {string} newEmail - The new email address
 * @param {boolean} requireConfirmation - Whether to require email confirmation
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateUserEmail(userId, newEmail, requireConfirmation = true) {
  return updateUserMetadata(userId, { email: newEmail, emailConfirm: requireConfirmation })
}

/**
 * Ban a user for a specified duration
 * @param {string} userId - The ID of the user to ban
 * @param {number} durationHours - Ban duration in hours
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function banUser(userId, durationHours) {
  return updateUserMetadata(userId, { banDuration: durationHours })
}

/**
 * Unban a user
 * @param {string} userId - The ID of the user to unban
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function unbanUser(userId) {
  return updateUserMetadata(userId, { banDuration: 0 })
}
