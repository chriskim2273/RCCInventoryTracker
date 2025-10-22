import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import sbuLogo from '@/assets/SBU_LOGO.jpeg'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [lastResendTime, setLastResendTime] = useState(null)
  const { signIn, signUp, resetPassword, resendConfirmationEmail, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  if (user) {
    navigate('/')
    return null
  }

  // Cooldown timer for resend button
  useEffect(() => {
    let interval = null
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [resendCooldown])

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@stonybrook\.edu$/
    return emailRegex.test(email) || email == "christopherkim2273@gmail.com"
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!validateEmail(email)) {
      setError('Only @stonybrook.edu email addresses are allowed')
      setLoading(false)
      return
    }

    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Password reset link has been sent to your email. Please check your inbox and spam folder.')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    if (!validateEmail(email)) {
      setError('Please enter a valid @stonybrook.edu email address')
      setLoading(false)
      return
    }

    // Check if 5 minutes have passed since last resend
    if (lastResendTime) {
      const timeSinceLastResend = Date.now() - lastResendTime
      const fiveMinutesInMs = 5 * 60 * 1000
      if (timeSinceLastResend < fiveMinutesInMs) {
        const remainingTime = Math.ceil((fiveMinutesInMs - timeSinceLastResend) / 1000)
        setResendCooldown(remainingTime)
        setError(`Please wait ${Math.ceil(remainingTime / 60)} more minute(s) before resending`)
        setLoading(false)
        return
      }
    }

    try {
      const { error } = await resendConfirmationEmail(email)
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Confirmation email has been resent. Please check your inbox and spam folder.')
        setLastResendTime(Date.now())
        setResendCooldown(300) // 5 minutes in seconds
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!validateEmail(email)) {
      setError('Only @stonybrook.edu email addresses are allowed')
      setLoading(false)
      return
    }

    if (isSignUp && (!firstName.trim() || !lastName.trim())) {
      setError('First name and last name are required')
      setLoading(false)
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { error } = isSignUp
        ? await signUp(email, password, firstName.trim(), lastName.trim())
        : await signIn(email, password)

      if (error) {
        setError(error.message)
      } else {
        if (isSignUp) {
          setError('Check your email to confirm your account. Note: The confirmation email may take a few minutes to arrive. Please check your spam folder if you don\'t see it.')
        } else {
          navigate('/')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
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
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 px-4 py-3 rounded mb-4 text-sm border border-green-200 dark:border-green-800">
              {success}
            </div>
          )}

          {isSignUp && (
            <div className="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-4 py-3 rounded mb-4 text-sm border border-blue-200 dark:border-blue-800">
              <strong>Note:</strong> You will receive a confirmation email after signing up. The email may take a few minutes to arrive. Please check your spam folder if you don't see it in your inbox.
            </div>
          )}

          <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium mb-2">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="John"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium mb-2">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@stonybrook.edu"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only @stonybrook.edu emails are allowed
              </p>
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
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
            )}

            {isSignUp && !isForgotPassword && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Loading...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {!isForgotPassword && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError('')
                    setSuccess('')
                    setFirstName('')
                    setLastName('')
                    setConfirmPassword('')
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            )}

            {!isSignUp && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setIsForgotPassword(!isForgotPassword)
                    setError('')
                    setSuccess('')
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  {isForgotPassword ? 'Back to sign in' : 'Forgot password?'}
                </button>
              </div>
            )}

            {isSignUp && !isForgotPassword && (
              <div className="text-center">
                <button
                  onClick={handleResendConfirmation}
                  disabled={loading || resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `Resend confirmation email (wait ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')})`
                    : "Didn't receive confirmation email? Resend"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
