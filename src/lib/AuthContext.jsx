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
    let mounted = true

    // Safety fallback timeout: under no circumstances should the loader stay up for more than 3 seconds
    const safetyTimeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization safety timeout reached; ending loading state.');
        setIsLoadingAuth(false);
      }
    }, 3000);

    // Retrieve active session immediately on mount to avoid stuck loading states
    const initializeAuth = async () => {
      // Optimistic load: check if we have cached profile in localStorage for instant render
      try {
        const cachedUserStr = localStorage.getItem('app_user_data');
        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr);
          if (cachedUser) {
            setUser(cachedUser);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load optimistic cached user:', e);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          if (session?.user) {
            try {
              const currentUser = await auth.me()
              if (mounted) {
                setUser(currentUser)
                setIsAuthenticated(true)
              }
            } catch (error) {
              console.error('Error fetching profile during init:', error)
              if (mounted) {
                setUser(null)
                setIsAuthenticated(false)
              }
            }
          } else {
            if (mounted) {
              setUser(null)
              setIsAuthenticated(false)
            }
          }
        }
      } catch (error) {
        console.error('Failed to get initial session:', error)
      } finally {
        clearTimeout(safetyTimeoutId);
        if (mounted) {
          setIsLoadingAuth(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (session?.user) {
            try {
              const currentUser = await auth.me()
              if (mounted) {
                setUser(currentUser)
                setIsAuthenticated(true)
              }
            } catch (error) {
              console.error('Error fetching profile after auth change:', error)
              if (mounted) {
                setUser(null)
                setIsAuthenticated(false)
              }
            }
          } else {
            if (mounted) {
              setUser(null)
              setIsAuthenticated(false)
            }
          }
          if (mounted) {
            setIsLoadingAuth(false)
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null)
            setIsAuthenticated(false)
            setIsLoadingAuth(false)
          }
        } else {
          // Fallback to ensure loading ends for any other events (e.g. USER_UPDATED)
          if (mounted) {
            setIsLoadingAuth(false)
          }
        }
      }
    )

    // Listen for auth modal events dispatched from Navbar etc.
    const handler = () => setShowAuthModal(true)
    window.addEventListener('app:open-auth-modal', handler)

    return () => {
      mounted = false
      clearTimeout(safetyTimeoutId)
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