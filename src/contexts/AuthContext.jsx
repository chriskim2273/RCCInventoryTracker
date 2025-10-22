import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id)
      } else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, first_name, last_name, email')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserRole(data?.role || null)
      // Store user profile data in the user object
      if (data) {
        setUser(prev => ({
          ...prev,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email
        }))
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUp = async (email, password, firstName, lastName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setUserRole(null)
    }
    return { error }
  }

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  const resendConfirmationEmail = async (email) => {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })
    return { data, error }
  }

  const value = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    resendConfirmationEmail,
    isAdmin: userRole === 'admin',
    isCoordinator: userRole === 'coordinator',
    isEditor: userRole === 'editor',
    isViewer: userRole === 'viewer',
    isPending: userRole === 'pending',
    canEdit: userRole === 'admin' || userRole === 'coordinator' || userRole === 'editor',
    canView: userRole !== 'pending' && userRole !== null,
    canManageUsers: userRole === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
