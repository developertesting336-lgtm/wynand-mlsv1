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
import { Mail, ShieldCheck, RefreshCw, ArrowLeft, X } from 'lucide-react'

// ─── Country data for phone picker (195 countries) ───────────────────────────
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', dial: '+93' },
  { name: 'Albania', code: 'AL', dial: '+355' },
  { name: 'Algeria', code: 'DZ', dial: '+213' },
  { name: 'Andorra', code: 'AD', dial: '+376' },
  { name: 'Angola', code: 'AO', dial: '+244' },
  { name: 'Antigua and Barbuda', code: 'AG', dial: '+1268' },
  { name: 'Argentina', code: 'AR', dial: '+54' },
  { name: 'Armenia', code: 'AM', dial: '+374' },
  { name: 'Australia', code: 'AU', dial: '+61' },
  { name: 'Austria', code: 'AT', dial: '+43' },
  { name: 'Azerbaijan', code: 'AZ', dial: '+994' },
  { name: 'Bahamas', code: 'BS', dial: '+1242' },
  { name: 'Bahrain', code: 'BH', dial: '+973' },
  { name: 'Bangladesh', code: 'BD', dial: '+880' },
  { name: 'Barbados', code: 'BB', dial: '+1246' },
  { name: 'Belarus', code: 'BY', dial: '+375' },
  { name: 'Belgium', code: 'BE', dial: '+32' },
  { name: 'Belize', code: 'BZ', dial: '+501' },
  { name: 'Benin', code: 'BJ', dial: '+229' },
  { name: 'Bhutan', code: 'BT', dial: '+975' },
  { name: 'Bolivia', code: 'BO', dial: '+591' },
  { name: 'Bosnia and Herzegovina', code: 'BA', dial: '+387' },
  { name: 'Botswana', code: 'BW', dial: '+267' },
  { name: 'Brazil', code: 'BR', dial: '+55' },
  { name: 'Brunei', code: 'BN', dial: '+673' },
  { name: 'Bulgaria', code: 'BG', dial: '+359' },
  { name: 'Burkina Faso', code: 'BF', dial: '+226' },
  { name: 'Burundi', code: 'BI', dial: '+257' },
  { name: 'Cabo Verde', code: 'CV', dial: '+238' },
  { name: 'Cambodia', code: 'KH', dial: '+855' },
  { name: 'Cameroon', code: 'CM', dial: '+237' },
  { name: 'Canada', code: 'CA', dial: '+1' },
  { name: 'Central African Republic', code: 'CF', dial: '+236' },
  { name: 'Chad', code: 'TD', dial: '+235' },
  { name: 'Chile', code: 'CL', dial: '+56' },
  { name: 'China', code: 'CN', dial: '+86' },
  { name: 'Colombia', code: 'CO', dial: '+57' },
  { name: 'Comoros', code: 'KM', dial: '+269' },
  { name: 'Congo (Brazzaville)', code: 'CG', dial: '+242' },
  { name: 'Congo (Kinshasa)', code: 'CD', dial: '+243' },
  { name: 'Costa Rica', code: 'CR', dial: '+506' },
  { name: 'Croatia', code: 'HR', dial: '+385' },
  { name: 'Cuba', code: 'CU', dial: '+53' },
  { name: 'Cyprus', code: 'CY', dial: '+357' },
  { name: 'Czech Republic', code: 'CZ', dial: '+420' },
  { name: 'Denmark', code: 'DK', dial: '+45' },
  { name: 'Djibouti', code: 'DJ', dial: '+253' },
  { name: 'Dominica', code: 'DM', dial: '+1767' },
  { name: 'Dominican Republic', code: 'DO', dial: '+1809' },
  { name: 'East Timor', code: 'TL', dial: '+670' },
  { name: 'Ecuador', code: 'EC', dial: '+593' },
  { name: 'Egypt', code: 'EG', dial: '+20' },
  { name: 'El Salvador', code: 'SV', dial: '+503' },
  { name: 'Equatorial Guinea', code: 'GQ', dial: '+240' },
  { name: 'Eritrea', code: 'ER', dial: '+291' },
  { name: 'Estonia', code: 'EE', dial: '+372' },
  { name: 'Eswatini', code: 'SZ', dial: '+268' },
  { name: 'Ethiopia', code: 'ET', dial: '+251' },
  { name: 'Fiji', code: 'FJ', dial: '+679' },
  { name: 'Finland', code: 'FI', dial: '+358' },
  { name: 'France', code: 'FR', dial: '+33' },
  { name: 'Gabon', code: 'GA', dial: '+241' },
  { name: 'Gambia', code: 'GM', dial: '+220' },
  { name: 'Georgia', code: 'GE', dial: '+995' },
  { name: 'Germany', code: 'DE', dial: '+49' },
  { name: 'Ghana', code: 'GH', dial: '+233' },
  { name: 'Greece', code: 'GR', dial: '+30' },
  { name: 'Grenada', code: 'GD', dial: '+1473' },
  { name: 'Guatemala', code: 'GT', dial: '+502' },
  { name: 'Guinea', code: 'GN', dial: '+224' },
  { name: 'Guinea-Bissau', code: 'GW', dial: '+245' },
  { name: 'Guyana', code: 'GY', dial: '+592' },
  { name: 'Haiti', code: 'HT', dial: '+509' },
  { name: 'Honduras', code: 'HN', dial: '+504' },
  { name: 'Hungary', code: 'HU', dial: '+36' },
  { name: 'Iceland', code: 'IS', dial: '+354' },
  { name: 'India', code: 'IN', dial: '+91' },
  { name: 'Indonesia', code: 'ID', dial: '+62' },
  { name: 'Iran', code: 'IR', dial: '+98' },
  { name: 'Iraq', code: 'IQ', dial: '+964' },
  { name: 'Ireland', code: 'IE', dial: '+353' },
  { name: 'Israel', code: 'IL', dial: '+972' },
  { name: 'Italy', code: 'IT', dial: '+39' },
  { name: 'Ivory Coast', code: 'CI', dial: '+225' },
  { name: 'Jamaica', code: 'JM', dial: '+1876' },
  { name: 'Japan', code: 'JP', dial: '+81' },
  { name: 'Jordan', code: 'JO', dial: '+962' },
  { name: 'Kazakhstan', code: 'KZ', dial: '+7' },
  { name: 'Kenya', code: 'KE', dial: '+254' },
  { name: 'Kiribati', code: 'KI', dial: '+686' },
  { name: 'Kuwait', code: 'KW', dial: '+965' },
  { name: 'Kyrgyzstan', code: 'KG', dial: '+996' },
  { name: 'Laos', code: 'LA', dial: '+856' },
  { name: 'Latvia', code: 'LV', dial: '+371' },
  { name: 'Lebanon', code: 'LB', dial: '+961' },
  { name: 'Lesotho', code: 'LS', dial: '+266' },
  { name: 'Liberia', code: 'LR', dial: '+231' },
  { name: 'Libya', code: 'LY', dial: '+218' },
  { name: 'Liechtenstein', code: 'LI', dial: '+423' },
  { name: 'Lithuania', code: 'LT', dial: '+370' },
  { name: 'Luxembourg', code: 'LU', dial: '+352' },
  { name: 'Madagascar', code: 'MG', dial: '+261' },
  { name: 'Malawi', code: 'MW', dial: '+265' },
  { name: 'Malaysia', code: 'MY', dial: '+60' },
  { name: 'Maldives', code: 'MV', dial: '+960' },
  { name: 'Mali', code: 'ML', dial: '+223' },
  { name: 'Malta', code: 'MT', dial: '+356' },
  { name: 'Marshall Islands', code: 'MH', dial: '+692' },
  { name: 'Mauritania', code: 'MR', dial: '+222' },
  { name: 'Mauritius', code: 'MU', dial: '+230' },
  { name: 'Mexico', code: 'MX', dial: '+52' },
  { name: 'Micronesia', code: 'FM', dial: '+691' },
  { name: 'Moldova', code: 'MD', dial: '+373' },
  { name: 'Monaco', code: 'MC', dial: '+377' },
  { name: 'Mongolia', code: 'MN', dial: '+976' },
  { name: 'Montenegro', code: 'ME', dial: '+382' },
  { name: 'Morocco', code: 'MA', dial: '+212' },
  { name: 'Mozambique', code: 'MZ', dial: '+258' },
  { name: 'Myanmar', code: 'MM', dial: '+95' },
  { name: 'Namibia', code: 'NA', dial: '+264' },
  { name: 'Nauru', code: 'NR', dial: '+674' },
  { name: 'Nepal', code: 'NP', dial: '+977' },
  { name: 'Netherlands', code: 'NL', dial: '+31' },
  { name: 'New Zealand', code: 'NZ', dial: '+64' },
  { name: 'Nicaragua', code: 'NI', dial: '+505' },
  { name: 'Niger', code: 'NE', dial: '+227' },
  { name: 'Nigeria', code: 'NG', dial: '+234' },
  { name: 'North Korea', code: 'KP', dial: '+850' },
  { name: 'North Macedonia', code: 'MK', dial: '+389' },
  { name: 'Norway', code: 'NO', dial: '+47' },
  { name: 'Oman', code: 'OM', dial: '+968' },
  { name: 'Pakistan', code: 'PK', dial: '+92' },
  { name: 'Palau', code: 'PW', dial: '+680' },
  { name: 'Palestine', code: 'PS', dial: '+970' },
  { name: 'Panama', code: 'PA', dial: '+507' },
  { name: 'Papua New Guinea', code: 'PG', dial: '+675' },
  { name: 'Paraguay', code: 'PY', dial: '+595' },
  { name: 'Peru', code: 'PE', dial: '+51' },
  { name: 'Philippines', code: 'PH', dial: '+63' },
  { name: 'Poland', code: 'PL', dial: '+48' },
  { name: 'Portugal', code: 'PT', dial: '+351' },
  { name: 'Qatar', code: 'QA', dial: '+974' },
  { name: 'Romania', code: 'RO', dial: '+40' },
  { name: 'Russia', code: 'RU', dial: '+7' },
  { name: 'Rwanda', code: 'RW', dial: '+250' },
  { name: 'Saint Kitts and Nevis', code: 'KN', dial: '+1869' },
  { name: 'Saint Lucia', code: 'LC', dial: '+1758' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC', dial: '+1784' },
  { name: 'Samoa', code: 'WS', dial: '+685' },
  { name: 'San Marino', code: 'SM', dial: '+378' },
  { name: 'Sao Tome and Principe', code: 'ST', dial: '+239' },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966' },
  { name: 'Senegal', code: 'SN', dial: '+221' },
  { name: 'Serbia', code: 'RS', dial: '+381' },
  { name: 'Seychelles', code: 'SC', dial: '+248' },
  { name: 'Sierra Leone', code: 'SL', dial: '+232' },
  { name: 'Singapore', code: 'SG', dial: '+65' },
  { name: 'Slovakia', code: 'SK', dial: '+421' },
  { name: 'Slovenia', code: 'SI', dial: '+386' },
  { name: 'Solomon Islands', code: 'SB', dial: '+677' },
  { name: 'Somalia', code: 'SO', dial: '+252' },
  { name: 'South Africa', code: 'ZA', dial: '+27' },
  { name: 'South Korea', code: 'KR', dial: '+82' },
  { name: 'South Sudan', code: 'SS', dial: '+211' },
  { name: 'Spain', code: 'ES', dial: '+34' },
  { name: 'Sri Lanka', code: 'LK', dial: '+94' },
  { name: 'Sudan', code: 'SD', dial: '+249' },
  { name: 'Suriname', code: 'SR', dial: '+597' },
  { name: 'Sweden', code: 'SE', dial: '+46' },
  { name: 'Switzerland', code: 'CH', dial: '+41' },
  { name: 'Syria', code: 'SY', dial: '+963' },
  { name: 'Taiwan', code: 'TW', dial: '+886' },
  { name: 'Tajikistan', code: 'TJ', dial: '+992' },
  { name: 'Tanzania', code: 'TZ', dial: '+255' },
  { name: 'Thailand', code: 'TH', dial: '+66' },
  { name: 'Togo', code: 'TG', dial: '+228' },
  { name: 'Tonga', code: 'TO', dial: '+676' },
  { name: 'Trinidad and Tobago', code: 'TT', dial: '+1868' },
  { name: 'Tunisia', code: 'TN', dial: '+216' },
  { name: 'Turkey', code: 'TR', dial: '+90' },
  { name: 'Turkmenistan', code: 'TM', dial: '+993' },
  { name: 'Tuvalu', code: 'TV', dial: '+688' },
  { name: 'Uganda', code: 'UG', dial: '+256' },
  { name: 'Ukraine', code: 'UA', dial: '+380' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971' },
  { name: 'United Kingdom', code: 'GB', dial: '+44' },
  { name: 'United States', code: 'US', dial: '+1' },
  { name: 'Uruguay', code: 'UY', dial: '+598' },
  { name: 'Uzbekistan', code: 'UZ', dial: '+998' },
  { name: 'Vanuatu', code: 'VU', dial: '+678' },
  { name: 'Vatican City', code: 'VA', dial: '+379' },
  { name: 'Venezuela', code: 'VE', dial: '+58' },
  { name: 'Vietnam', code: 'VN', dial: '+84' },
  { name: 'Yemen', code: 'YE', dial: '+967' },
  { name: 'Zambia', code: 'ZM', dial: '+260' },
  { name: 'Zimbabwe', code: 'ZW', dial: '+263' },
];

// Flag image from flagcdn.com — works on all OS (Windows included)
function FlagImg({ code, size = 20 }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={code}
      style={{ objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
      onError={(e) => { e.target.style.visibility = 'hidden'; }}
    />
  );
}

// ─── PhoneInput with country code + flag ────────────────────────────────────
function PhoneInput({ value, onChange }) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.code === 'MX'));
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setNumber(raw);
    onChange(`${selectedCountry.dial}${raw}`);
  };

  const handleSelect = (country) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    onChange(`${country.dial}${number}`);
  };

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  return (
    <div className="flex gap-2 mt-1" ref={dropdownRef}>
      {/* Country Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 h-10 border rounded-md bg-white text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <FlagImg code={selectedCountry.code} />
          <span className="text-gray-700">{selectedCountry.dial}</span>
          <svg className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-xl shadow-xl w-72 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b">
              <input
                autoFocus
                className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search country or code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* List */}
            <ul className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400 text-center">No results</li>
              ) : (
                filtered.map(c => (
                  <li
                    key={`${c.code}-${c.dial}`}
                    onClick={() => handleSelect(c)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors text-sm ${selectedCountry.code === c.code && selectedCountry.dial === c.dial ? 'bg-primary/5 font-semibold' : ''}`}
                  >
                    <FlagImg code={c.code} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-gray-400 text-xs">{c.dial}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Number Input */}
      <input
        id="phone_number"
        type="tel"
        inputMode="numeric"
        placeholder="Phone number"
        value={number}
        onChange={handleNumberChange}
        className="flex-1 h-10 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
      />
    </div>
  );
}

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
  const [form, setForm] = useState(() => {
    const isReferPage = typeof window !== 'undefined' && window.location.pathname === '/refer';
    return { email: '', password: '', full_name: '', phone_number: '', role: isReferPage ? 'agent' : 'renter' };
  })
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')

  // Watch for path changes or custom events to reset role to agent if on /refer
  useEffect(() => {
    if (isOpen) {
      const isReferPage = typeof window !== 'undefined' && window.location.pathname === '/refer';
      if (isReferPage) {
        setForm(prev => ({ ...prev, role: 'agent' }));
      }
    }
  }, [isOpen]);

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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
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
              <PhoneInput
                value={form.phone_number}
                onChange={(val) => handleChange('phone_number', val)}
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
                  <SelectItem value="agent">List a rental Property (Agent)</SelectItem>
                  <SelectItem value="owner">List my own Property (Owner)</SelectItem>
                  <SelectItem value="renter">Search for a Property</SelectItem>
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
