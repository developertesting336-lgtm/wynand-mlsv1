import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Mail, ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react'

// ─── OTP digit input component ──────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]
        next[idx] = ''
        onChange(next.join(''))
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus()
      }
    }
  }

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = val
    onChange(next.join(''))
    if (val && idx < 5) {
      inputs.current[idx + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    inputs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-2xl font-bold border-2 rounded-lg outline-none transition-all
            border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-gray-50 focus:bg-white"
          style={{ caretColor: 'transparent' }}
        />
      ))}
    </div>
  )
}

// ─── Main AuthModal ─────────────────────────────────────────────────────────
export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'otp' | 'reset-password' | 'reset-otp' | 'reset-success'
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone_number: '', role: 'renter' })
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')

  // countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  if (!isOpen) return null

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const redirectByRole = (role) => {
    setTimeout(() => {
      if (role === 'admin') window.location.href = '/admin'
      else if (role === 'owner') window.location.href = '/owner-dashboard'
      else if (role === 'agent') window.location.href = '/agent-dashboard'
      else window.location.href = '/dashboard'
    }, 500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        if (!form.full_name.trim()) throw { message: 'Full name is required' }
        if (form.password.length < 6) throw { message: 'Password must be at least 6 characters' }

        const result = await auth.signUp({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone_number: form.phone_number,
          role: form.role,
        })

        if (result.otpPending) {
          // Switch to OTP verification step
          setOtp('')
          setResendCooldown(60)
          setMode('otp')
          toast.success('Account created! Check your email for the verification code.')
        }

      } else if (mode === 'login') {
        const result = await auth.signIn({ email: form.email, password: form.password })
        toast.success('Logged in successfully!')
        if (onAuthSuccess) onAuthSuccess(result.user)
        setForm({ email: '', password: '', full_name: '', phone_number: '', role: 'renter' })
        onClose()
        redirectByRole(result.user?.role)

      } else if (mode === 'otp') {
        if (otp.replace(/\D/g, '').length < 6) throw { message: 'Please enter the full 6-digit code' }

        const result = await auth.verifySignupOtp({
          email: form.email,
          otp: otp.trim(),
          password: form.password,
          full_name: form.full_name,
          phone_number: form.phone_number,
          role: form.role,
        })
        toast.success('Email verified! Welcome aboard 🎉')
        if (onAuthSuccess) onAuthSuccess(result.user)
        setForm({ email: '', password: '', full_name: '', phone_number: '', role: 'renter' })
        setOtp('')
        onClose()
        redirectByRole(result.user?.role)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')
    try {
      await auth.sendSignupOtp({ email: form.email, phone_number: form.phone_number })
      setResendCooldown(60)
      toast.success('A new code was sent to your email.')
    } catch (err) {
      setError(err.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(prev => prev === 'login' ? 'signup' : 'login')
    setError('')
    setOtp('')
  }

  // ── Reset Password Functions ──────────────────────────────────────────────
  const checkIfEmailExists = async (email) => {
    // Check if email exists in profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    return !!data && !error
  }

  const handleRequestReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const email = form.email.toLowerCase().trim()
      
      // First check if account exists
      const accountExists = await checkIfEmailExists(email)
      
      if (!accountExists) {
        setError('Account does not exist. Please check your email or sign up.')
        setLoading(false)
        return
      }

      // Account exists, send OTP
      const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'
      
      const res = await fetch(`${emailServerUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to send reset email' }
      }

      toast.success(`OTP sent to ${email}`)
      setMode('reset-otp')
      setResendCooldown(60)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResetResend = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')

    try {
      const email = form.email.toLowerCase().trim()
      
      // Verify account still exists before resending
      const accountExists = await checkIfEmailExists(email)
      
      if (!accountExists) {
        setError('Account does not exist.')
        setLoading(false)
        return
      }

      const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'
      
      const res = await fetch(`${emailServerUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to resend OTP' }
      }

      toast.success(`A new code was sent to ${email}`)
      setResendCooldown(60)
    } catch (err) {
      setError(err.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'
      
      const res = await fetch(`${emailServerUrl}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.toLowerCase().trim(),
          otp: otp.trim(),
          newPassword,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to reset password' }
      }

      toast.success('Password reset successfully! You can now sign in.')
      setMode('reset-success')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Reset Password: Email Step ───────────────────────────────────────────
  if (mode === 'reset-password') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <Mail className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold">Reset Password</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter your email and we'll send you a verification code
            </p>
          </div>

          <form onSubmit={handleRequestReset} className="space-y-5">
            <div>
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => { handleChange('email', e.target.value); setError('') }}
                required
                className="mt-1"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200 text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </Button>
          </form>

          <button
            onClick={() => { setMode('login'); setError(''); setOtp(''); setNewPassword(''); setConfirmPassword('') }}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // ── Reset Password: OTP + New Password Step ──────────────────────────────
  if (mode === 'reset-otp') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold">Enter Verification Code</h2>
            <p className="text-sm text-gray-500 mt-1">
              We sent a 6-digit code to <br />
              <span className="font-medium text-gray-700">{form.email}</span>
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <Label className="text-center block text-sm text-gray-500 mb-3">Enter verification code</Label>
              <OtpInput value={otp} onChange={setOtp} />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError('') }}
                required
                minLength={6}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                required
                minLength={6}
                className="mt-1"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200 text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base gap-2"
              disabled={loading || otp.replace(/\D/g, '').length < 6}
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>

          {/* Resend */}
          <div className="mt-5 text-center text-sm text-gray-500">
            <p>Didn't receive the code?</p>
            <button
              onClick={handleResetResend}
              disabled={resendCooldown > 0 || loading}
              className="mt-1 flex items-center gap-1.5 mx-auto text-blue-600 font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <button
            onClick={() => { setMode('reset-password'); setError(''); setOtp(''); setNewPassword(''); setConfirmPassword('') }}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to email
          </button>
        </div>
      </div>
    )
  }

  // ── Reset Password: Success Step ─────────────────────────────────────────
  if (mode === 'reset-success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4 mx-auto">
            <ShieldCheck className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Password Reset!</h2>
          <p className="text-slate-600 mb-6">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button 
            onClick={() => { setMode('login'); setError(''); setOtp(''); setNewPassword(''); setConfirmPassword('') }}
            className="w-full h-11 text-base"
          >
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  // ── OTP Step ─────────────────────────────────────────────────────────────
  if (mode === 'otp') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <Mail className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold">Check your email</h2>
            <p className="text-sm text-gray-500 mt-1">
              We sent a 6-digit code to <br />
              <span className="font-medium text-gray-700">{form.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-center block text-sm text-gray-500 mb-3">Enter verification code</Label>
              <OtpInput value={otp} onChange={setOtp} />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200 text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base gap-2"
              disabled={loading || otp.replace(/\D/g, '').length < 6}
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>
          </form>

          {/* Resend */}
          <div className="mt-5 text-center text-sm text-gray-500">
            <p>Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || loading}
              className="mt-1 flex items-center gap-1.5 mx-auto text-blue-600 font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <button
            onClick={() => { setMode('signup'); setError('') }}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back to sign up
          </button>
        </div>
      </div>
    )
  }

  // ── Login / Signup Step ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? 'Welcome back! Please sign in to your account.'
              : 'Get started with your free account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="Your full name"
                value={form.full_name}
                onChange={e => handleChange('full_name', e.target.value)}
                required
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={form.phone_number}
                onChange={e => handleChange('phone_number', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <Label htmlFor="role">I want to...</Label>
              <Select value={form.role} onValueChange={v => handleChange('role', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renter">Rent a property</SelectItem>
                  <SelectItem value="owner">List my property (Owner)</SelectItem>
                  <SelectItem value="agent">Become an Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <div className="space-y-2">
                <p>
                  Don't have an account?{' '}
                  <button onClick={switchMode} className="text-primary font-medium hover:underline">
                    Sign up
                  </button>
                </p>
                <p>
                  <button 
                    onClick={() => setMode('reset-password')}
                    className="text-primary font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </p>
              </div>
            ) : (
            <p>
              Already have an account?{' '}
              <button onClick={switchMode} className="text-primary font-medium hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
