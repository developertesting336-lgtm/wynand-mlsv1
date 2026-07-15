import { supabase } from '@/lib/supabase'
import { auditLogger } from '@/utils/auditLogger'

/**
 * Supabase Auth System – Email/Password only.
 * Uses Supabase Auth for authentication (NOT custom JWT).
 * Users stored in both auth.users (Supabase) and profiles (app data).
 * 
 * NOTE: Custom JWT logic has been commented out and replaced with Supabase Auth.
 */

// ============================================================
// Session helpers
// ============================================================
const USER_KEY = 'app_user_data'

function storeSession(user) {
  // Cache profile in localStorage so UI can render without an extra round-trip
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(USER_KEY)
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) }
  catch { return null }
}

// ============================================================
// DEPRECATED: Custom JWT token functions (commented out)
// ============================================================
/*
function generateToken(userId, email) {
  const payload = btoa(JSON.stringify({
    sub: userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  }))
  return `simple.${payload}.sig`
}

function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch { return null }
}

// DEPRECATED: Password hashing (now handled by Supabase Auth)
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
*/

// ============================================================
// Auth API
// ============================================================
// Event system for auth modal trigger
const AUTH_MODAL_EVENT = 'app:open-auth-modal'

/** Dispatch event to open auth modal (listened by AuthContext) */
function dispatchAuthModalEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_MODAL_EVENT))
  }
}

export const auth = {
  /** Returns current user (throws if not authenticated) */
  async me() {
    // Use Supabase Auth to get current session
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      clearSession()
      throw { status: 401, message: 'Not authenticated' }
    }

    // Get profile data from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile) {
      clearSession()
      throw { status: 401, message: 'User profile not found' }
    }

    // Store profile in localStorage for quick access
    storeSession(profile)
    return profile
  },

  /** Returns user or null (no throw) */
  async check() {
    try { return await this.me() }
    catch { return null }
  },

  /**
   * Sign up – Step 1: validate uniqueness & send OTP via the email server.
   * The email server (VITE_EMAIL_SERVER_URL) handles:
   *   - duplicate email / phone checks
   *   - OTP generation & storage (profiles.reset_otp)
   *   - sending the verification email
   * We do NOT create a Supabase auth user yet – that happens after OTP confirmation.
   */
  async signUp({ email, password, full_name, phone_number, role }) {
    const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'

    const res = await fetch(`${emailServerUrl}/send-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        phone_number: phone_number || '',
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      // Surface friendly duplicate / validation errors from the email server
      throw { status: res.status, message: json.error || 'Failed to send OTP' }
    }

    // OTP sent successfully – signal the UI to show the OTP step
    return {
      otpPending: true,
      email: email.toLowerCase().trim(),
    }
  },

  /**
   * Resend signup OTP (same endpoint, same logic).
   * Re-uses signUp so duplicates are re-checked and a fresh OTP is issued.
   */
  async sendSignupOtp({ email, phone_number }) {
    const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'

    const res = await fetch(`${emailServerUrl}/send-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        phone_number: phone_number || '',
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      throw { status: res.status, message: json.error || 'Failed to resend OTP' }
    }
    return json
  },

  /**
   * Verify signup OTP – Step 2.
   * 1. Calls email-server /verify-signup-otp to validate the code and update the
   *    temp profile row with the user's full details.
   * 2. Creates the Supabase Auth user (auth.users) so they can sign in.
   * 3. Signs the user in and returns the profile.
   */
  async verifySignupOtp({ email, otp, password, full_name, phone_number, role }) {
    const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'

    // Step 1 – validate OTP, create auth user, and link profile (handled on backend)
    const verifyRes = await fetch(`${emailServerUrl}/verify-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
        password,
        full_name: full_name || '',
        phone_number: phone_number || '',
        role: role || 'renter',
      }),
    })

    const verifyJson = await verifyRes.json()
    if (!verifyRes.ok) {
      throw { status: verifyRes.status, message: verifyJson.error || 'Invalid or expired OTP' }
    }

    // Step 2 – sign in and load the profile
    return await this.signIn({ email, password })
  },

  /** Sign in with email & password */
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    })

    if (error) {
      console.error('Supabase signIn error:', error.message, error.status, error)
      // Surface the real Supabase message so we can diagnose issues
      throw { status: error.status || 401, message: error.message || 'Invalid email or password' }
    }

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Error fetching profile on sign-in:', profileError)
      throw { status: 500, message: 'Signed in but could not load your profile. Please try again.' }
    }

    storeSession(profile)
    
    // Log user login action
    try {
      await auditLogger.log('USER_LOGIN')
    } catch (e) {
      console.error('[auth] Failed to log USER_LOGIN:', e)
    }

    return { user: profile, session: data.session }
  },

  /** Logout */
  async logout(redirectUrl) {
    // Log user logout action before signing out (so user context is present)
    try {
      await auditLogger.log('USER_LOGOUT')
    } catch (e) {
      console.error('[auth] Failed to log USER_LOGOUT:', e)
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
    }
    clearSession()
    if (redirectUrl && typeof redirectUrl === 'string') {
      window.location.href = redirectUrl
    }
  },

  /** Update user profile */
  async updateMe(updates) {
    const user = await this.me()
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw { status: 500, message: error.message }
    storeSession(data)
    return data
  }
}

// ============================================================
// Email integration
// ============================================================
export const emailIntegration = {
  async SendEmail({ to, subject, html }) {
    if (import.meta.env.DEV) {
      console.log('📧 Email (dev):', { to, subject })
      return { success: true, devMode: true }
    }
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      })
      return await res.json()
    } catch (err) {
      console.error('Email failed:', err)
      throw { status: 500, message: 'Failed to send email' }
    }
  }
}

// ============================================================
// Storage integration
// ============================================================
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'MLS'

export const storageIntegration = {
  async UploadFile({ file, folder }) {
    let fileName = file.name;
    if (fileName.includes('/')) {
      const parts = fileName.split('/');
      fileName = parts[parts.length - 1];
    }
    const folderPrefix = folder ? `${folder}/` : '';
    const fullPath = `${folderPrefix}${Date.now()}_${fileName}`;

    console.log('Supabase storage upload', { bucket: storageBucket, path: fullPath, fileType: file.type })
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .upload(fullPath, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Supabase storage upload error', error)
      throw { status: 500, message: error.message || 'Upload failed' }
    }

    const { data: urlData, error: urlError } = supabase.storage.from(storageBucket).getPublicUrl(data.path)
    if (urlError) {
      console.error('Supabase storage public URL error', urlError)
      throw { status: 500, message: urlError.message || 'Failed to get public URL' }
    }

    return { file_url: urlData.publicUrl }
  }
}