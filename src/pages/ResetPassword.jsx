import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import sbuLogo from '@/assets/white-star-outlined.svg'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if this is a password recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired password reset link. Please request a new one.')
      }
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border rounded-lg shadow-lg p-6 sm:p-8">
            <div className="flex flex-col items-center justify-center mb-6 sm:mb-8">
              <img
                src={sbuLogo}
                alt="Stony Brook University"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain mb-3"
              />
              <h1 className="text-lg sm:text-xl font-bold text-center">RCC Inventory Tracker</h1>
            </div>

            <div className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 px-4 py-3 rounded mb-4 text-sm border border-green-200 dark:border-green-800">
              <strong>Success!</strong> Your password has been reset successfully. Redirecting to login...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-lg p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center mb-6 sm:mb-8">
            <img
              src={sbuLogo}
              alt="Stony Brook University"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain mb-3"
            />
            <h1 className="text-lg sm:text-xl font-bold text-center">RCC Inventory Tracker</h1>
          </div>

          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-center">
            Reset Your Password
          </h2>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
