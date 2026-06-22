import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RoleBasedRedirect } from './components/RoleBasedRedirect'

// admin Pages
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/Admin/DashboardPage'
import { CompaniesPage } from './pages/Admin/CompaniesPage'
import { EmployeesPage } from './pages/Admin/EmployeesPage'
import { EmployeeDetailPage } from './pages/Admin/EmployeeDetailPage'
import { UsersPage } from './pages/Admin/UsersPage'
import { AttendancePage } from './pages/Admin/AttendancePage'
import { EditShiftTimesPage } from './pages/Admin/EditShiftTimesPage'
import { NonCheckoutEmployeesPage } from './pages/Admin/NonCheckoutEmployeesPage'
import { WorkSessionsPage } from './pages/Admin/WorkSessionsPage'
import { OTHoursPage } from './pages/Admin/OTHoursPage'
import { EditOTRatesPage } from './pages/Admin/EditOTRatesPage'
import { IdleEmployeesPage } from './pages/Admin/IdleEmployeesPage'
import { BreaksPage } from './pages/Admin/BreaksPage'
import { ChangeoversPage } from './pages/Admin/ChangeoversPage'
import { ProcessesPage } from './pages/Admin/ProcessesPage'
import { AnalyticsPage } from './pages/Admin/AnalyticsPage'
import { PublicDashboardPage } from './pages/Public/PublicDashboardPage'

// Security Pages
import { AttendanceScanPage } from './pages/Security/AttendanceScanPage'

// Process Pages
import { ProcessScanPage } from './pages/Process/ProcessScanPage'

export function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/public-dashboard" element={<PublicDashboardPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleBasedRedirect />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/companies"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CompaniesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/companies/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CompaniesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EmployeeDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UsersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/attendance"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AttendancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/attendance/non-checkout"
              element={
                <ProtectedRoute requiredRole="admin">
                  <NonCheckoutEmployeesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/attendance/edit-shift-times"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EditShiftTimesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/work-sessions"
              element={
                <ProtectedRoute requiredRole="admin">
                  <WorkSessionsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ot-hours"
              element={
                <ProtectedRoute requiredRole="admin">
                  <OTHoursPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ot-hours/edit-rates"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EditOTRatesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/work-sessions/idle"
              element={
                <ProtectedRoute requiredRole="admin">
                  <IdleEmployeesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/breaks"
              element={
                <ProtectedRoute requiredRole="admin">
                  <BreaksPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/changeovers"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ChangeoversPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/processes"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ProcessesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/security/scan"
              element={
                <ProtectedRoute requiredRole="security">
                  <AttendanceScanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/process/scan"
              element={
                <ProtectedRoute requiredRole="process">
                  <ProcessScanPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={
              <ProtectedRoute>
                <RoleBasedRedirect />
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  )
}
