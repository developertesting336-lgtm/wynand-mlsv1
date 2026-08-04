import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

/**
 * RoleBasedRoute – redirects users to their own dashboard if they try to access
 * a route that doesn't belong to their role.
 *
 * Role → dashboard mapping:
 *   renter  → /dashboard
 *   owner   → /owner-dashboard
 *   agent   → /agent-dashboard
 *   admin   → /admin (bypass, can access everything)
 *
 * Props:
 *   allowedRoles: Array of roles permitted to access this route
 */

const ROLE_HOME = {
  renter: '/dashboard',
  owner: '/owner-dashboard',
  agent: '/agent-dashboard',
  admin: '/admin',
};

export default function RoleBasedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not logged in → send to home
  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const userRole = user.role || 'renter';

  // Admin bypasses all restrictions
  if (userRole === 'admin') {
    return children;
  }

  // Wrong role → redirect to their own dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    const destination = ROLE_HOME[userRole] || '/';
    return <Navigate to={destination} replace />;
  }

  return children;
}