import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  MapPin,
  Settings,
  LogOut
} from 'lucide-react'
import sbuLogo from '@/assets/SBU_LOGO.jpeg'

export default function Layout() {
  const { signOut, user, userRole, isAdmin, isCoordinator } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img
                src={sbuLogo}
                alt="Stony Brook University"
                className="h-10 w-10 object-contain"
              />
              <div className="border-l border-primary-foreground/30 pl-3">
                <h1 className="text-lg font-bold tracking-tight">RCC Inventory Tracker</h1>
              </div>
            </Link>

            <nav className="flex items-center gap-6">
              <Link
                to="/"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                to="/locations"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <MapPin className="h-4 w-4" />
                Locations
              </Link>

              {(isAdmin || isCoordinator) && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Link>
              )}

              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-primary-foreground/30">
                <div className="text-sm">
                  <div className="font-medium">{user?.email}</div>
                  <div className="text-xs opacity-75 capitalize">{userRole}</div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                  title="Sign Out"
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
