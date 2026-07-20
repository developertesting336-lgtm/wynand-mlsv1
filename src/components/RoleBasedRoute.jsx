import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

/**
 * RoleBasedRoute – redirects users based on their role.
 * 
 * Props:
 *   allowedRoles: Array of roles allowed to access this route
 *   fallbackPath: Where to redirect if user doesn't have access (default: '/')
 */
export default function RoleBasedRoute({ children, allowedRoles = [], fallbackPath = '/' }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth()
  const location = useLocation()

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />
  }

  const userRole = user.role || 'renter'

  // If user is admin, allow access to everything
  if (userRole === 'admin') {
    return children
  }

  // Check if user's role is in allowed list
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // If a renter is redirected from Stripe to /owner-dashboard, route them to /dashboard preserving stripe params
    if (userRole === 'renter' && location.pathname === '/owner-dashboard') {
      const params = new URLSearchParams(location.search);
      if (params.has('stripe')) {
        return <Navigate to={`/dashboard${location.search}`} replace />;
      }
    }
    return <Navigate to={fallbackPath} replace />
  }

  return children
}