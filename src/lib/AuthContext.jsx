import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Single source-of-truth: Supabase auth state changes
  // Handles: initial page load (INITIAL_SESSION), new logins (SIGNED_IN),
  // token refreshes (TOKEN_REFRESHED), and logouts (SIGNED_OUT).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)

        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (session?.user) {
            try {
              const currentUser = await auth.me()
              setUser(currentUser)
              setIsAuthenticated(true)
            } catch (error) {
              console.error('Error fetching profile after auth change:', error)
              setUser(null)
              setIsAuthenticated(false)
            }
          } else {
            // INITIAL_SESSION with no active session — user is logged out
            setUser(null)
            setIsAuthenticated(false)
          }
          setIsLoadingAuth(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAuthenticated(false)
          setIsLoadingAuth(false)
        }
      }
    )

    // Listen for auth modal events dispatched from Navbar etc.
    const handler = () => setShowAuthModal(true)
    window.addEventListener('app:open-auth-modal', handler)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('app:open-auth-modal', handler)
    }
  }, [])

  const checkSession = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await auth.check();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const login = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    auth.logout();
  }, []);

  const onAuthSuccess = useCallback((authUser) => {
    setUser(authUser);
    setIsAuthenticated(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      login,
      logout,
      navigateToLogin: login, // alias for backward compat with Navbar
      redirectToLogin: login, // alias for backward compat with Navbar
      checkUserAuth: checkSession,
      checkAppState: checkSession,
      authChecked: !isLoadingAuth
    }}>
      {children}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeModal}
        onAuthSuccess={onAuthSuccess}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};