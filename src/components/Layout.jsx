import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  ShoppingCart
} from 'lucide-react'
import sbuLogo from '@/assets/white-star.svg'

export default function Layout() {
  const { signOut, user, userRole, isAdmin, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getUserDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.email || 'User'
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity">
              <img
                src={sbuLogo}
                alt="Stony Brook University"
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain flex-shrink-0"
              />
              <div className="border-l border-primary-foreground/30 pl-2 sm:pl-3">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight">RCC Inventory Tracker</h1>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              <Link
                to="/"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                to="/items"
                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <Package className="h-4 w-4" />
                Items
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

              {(isAdmin || isCoordinator) && (
                <Link
                  to="/reorder-requests"
                  className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Reorders
                </Link>
              )}

              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-primary-foreground/30">
                <div className="text-sm">
                  <div className="font-medium">{getUserDisplayName()}</div>
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

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:opacity-80 transition-opacity"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pt-4 border-t border-primary-foreground/30 space-y-4">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </Link>

              <Link
                to="/items"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
              >
                <Package className="h-5 w-5" />
                Items
              </Link>

              <Link
                to="/locations"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
              >
                <MapPin className="h-5 w-5" />
                Locations
              </Link>

              {(isAdmin || isCoordinator) && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
                >
                  <Settings className="h-5 w-5" />
                  Admin
                </Link>
              )}

              {(isAdmin || isCoordinator) && (
                <Link
                  to="/reorder-requests"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Reorder Requests
                </Link>
              )}

              <div className="pt-4 mt-4 border-t border-primary-foreground/30 space-y-3">
                <div className="text-sm">
                  <div className="font-medium">{getUserDisplayName()}</div>
                  <div className="text-xs opacity-75 capitalize mt-1">{userRole}</div>
                </div>

                <button
                  onClick={async () => {
                    setMobileMenuOpen(false)
                    await handleSignOut()
                  }}
                  className="flex items-center gap-3 py-2 text-sm hover:opacity-80 transition-opacity"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
