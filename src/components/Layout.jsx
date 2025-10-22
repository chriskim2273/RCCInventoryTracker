import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  MapPin,
  Settings,
  LogOut,
  Package
} from 'lucide-react'

export default function Layout() {
  const { signOut, user, userRole, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              <h1 className="text-xl font-bold">Inventory Tracker</h1>
            </div>

            <nav className="flex items-center gap-6">
              <Link
                to="/"
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                to="/locations"
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <MapPin className="h-4 w-4" />
                Locations
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Link>
              )}

              <div className="flex items-center gap-3 ml-4 pl-4 border-l">
                <div className="text-sm">
                  <div className="font-medium">{user?.email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
