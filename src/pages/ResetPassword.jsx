import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Mail, ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react'

// OTP digit input component
function OtpInput({ value, onChange }) {
  const inputs = React.useRef([])
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

export default function ResetPassword() {
  const [step, setStep] = useState('email') // 'email' | 'otp' | 'success'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')

  // Countdown timer for resend
  React.useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleRequestReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'
      
      const res = await fetch(`${emailServerUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to send reset email' }
      }

      toast.success('If an account exists, you will receive an OTP')
      setStep('otp')
      setResendCooldown(60)
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
      const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'
      
      const res = await fetch(`${emailServerUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to resend OTP' }
      }

      toast.success('A new code was sent to your email')
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
          email: email.toLowerCase().trim(),
          otp: otp.trim(),
          newPassword,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw { message: json.error || 'Failed to reset password' }
      }

      toast.success('Password reset successfully! You can now sign in.')
      setStep('success')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Step 1: Email input
  if (step === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3 mx-auto">
                <Mail className="w-7 h-7 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
              <p className="text-sm text-slate-500 mt-1">
                Enter your email and we'll send you a verification code
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  className="mt-1"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              <Link to="/login" className="text-blue-600 hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: OTP + New Password
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3 mx-auto">
                <ShieldCheck className="w-7 h-7 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Enter Verification Code</h1>
              <p className="text-sm text-slate-500 mt-1">
                We sent a 6-digit code to <br />
                <span className="font-medium text-slate-700">{email}</span>
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <Label className="text-center block text-sm text-slate-500 mb-3">Enter verification code</Label>
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
            <div className="mt-5 text-center text-sm text-slate-500">
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
              onClick={() => { setStep('email'); setError(''); setOtp('') }}
              className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              ← Back to email
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Success
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4 mx-auto">
              <ShieldCheck className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Password Reset!</h1>
            <p className="text-slate-600 mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Link to="/login">
              <Button className="w-full h-11 text-base">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
