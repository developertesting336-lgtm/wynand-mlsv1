import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sooner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import RoleBasedRoute from '@/components/RoleBasedRoute';

import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import Listings from './pages/Listings';
import ListingDetail from './pages/ListingDetail';
import SubmitProperty from './pages/SubmitProperty';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AgentBilling from './pages/AgentBilling';
import AgentDirectory from './pages/AgentDirectory';
import MyFavorites from './pages/MyFavorites';
import UserDashboard from './pages/UserDashboard';
import OwnerDashboard from './pages/OwnerDashbaord';
import Refer from './pages/Refer';
import Pricing from './pages/Pricing';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, user } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const role = user?.role || 'renter';

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/agents" element={<AgentDirectory />} />
        <Route path="/refer" element={<Refer />} />
        <Route path="/profile" element={<Profile />} />

        {/* Renter-only routes */}
        <Route path="/dashboard" element={
          <RoleBasedRoute allowedRoles={['renter']}>
            <UserDashboard />
          </RoleBasedRoute>
        } />
        <Route path="/favorites" element={
          <RoleBasedRoute allowedRoles={['renter']}>
            <MyFavorites />
          </RoleBasedRoute>
        } />

        {/* Owner + Agent routes */}
        <Route path="/owner-dashboard" element={
          <RoleBasedRoute allowedRoles={['owner', 'agent']}>
            <OwnerDashboard />
          </RoleBasedRoute>
        } />
        <Route path="/submit-property" element={
          <RoleBasedRoute allowedRoles={['owner', 'agent']}>
            <SubmitProperty />
          </RoleBasedRoute>
        } />

        {/* Agent-only routes */}
        <Route path="/agent-dashboard" element={
          <RoleBasedRoute allowedRoles={['agent']}>
            <AgentDashboard />
          </RoleBasedRoute>
        } />
        <Route path="/agent-billing" element={
          <RoleBasedRoute allowedRoles={['agent']}>
            <AgentBilling />
          </RoleBasedRoute>
        } />

        {/* Admin-only routes */}
        <Route path="/admin" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </RoleBasedRoute>
        } />

        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App