import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Pending from '@/pages/Pending'
import Dashboard from '@/pages/Dashboard'
import Items from '@/pages/Items'
import LocationExplorer from '@/pages/LocationExplorer'
import ItemDetail from '@/pages/ItemDetail'
import AdminPanel from '@/pages/AdminPanel'
import ReorderRequests from '@/pages/ReorderRequests'
import Credits from '@/pages/Credits'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pending" element={<Pending />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="items" element={<Items />} />
            <Route path="locations" element={<LocationExplorer />} />
            <Route path="locations/:locationId" element={<LocationExplorer />} />
            <Route path="items/:itemId" element={<ItemDetail />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'coordinator']}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="reorder-requests"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ReorderRequests />
                </ProtectedRoute>
              }
            />
            <Route path="credits" element={<Credits />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
