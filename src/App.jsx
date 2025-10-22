import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Pending from '@/pages/Pending'
import Dashboard from '@/pages/Dashboard'
import LocationExplorer from '@/pages/LocationExplorer'
import ItemDetail from '@/pages/ItemDetail'
import AdminPanel from '@/pages/AdminPanel'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
