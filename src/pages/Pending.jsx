import { useAuth } from '@/contexts/AuthContext'
import { Clock } from 'lucide-react'
import sbuLogo from '@/assets/SBU_LOGO.jpeg'

export default function Pending() {
  const { signOut, user } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-lg p-6 sm:p-8 text-center">
          <div className="flex flex-col items-center justify-center mb-6 sm:mb-8">
            <img
              src={sbuLogo}
              alt="Stony Brook University"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain mb-3"
            />
            <h1 className="text-lg sm:text-xl font-bold">RCC Inventory Tracker</h1>
          </div>

          <div className="flex justify-center mb-4 sm:mb-6">
            <Clock className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
          </div>

          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Access Pending</h2>

          <p className="text-sm sm:text-base text-muted-foreground mb-2">
            Your account is awaiting approval from an administrator.
          </p>

          <p className="text-sm text-muted-foreground mb-6 sm:mb-8 break-all">
            Account: <span className="font-medium">{user?.email}</span>
          </p>

          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 text-xs sm:text-sm text-left">
            <p className="mb-2 font-medium">What happens next:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>An admin will review your request</li>
              <li>You'll be assigned a role (Admin, Editor, or Viewer)</li>
              <li>You'll receive access to the inventory system</li>
            </ul>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full bg-secondary text-secondary-foreground py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
