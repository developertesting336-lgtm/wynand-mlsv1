import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, CheckCircle, Loader2, Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { isSubscriptionActive } from '@/lib/utils';
import { toast } from 'sonner';
import { NEIGHBORHOODS, FURNISHED_OPTIONS, RENTAL_TYPES, GROUPED_NEIGHBORHOODS } from '@/lib/constants';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

  useEffect(() => {
    // If external value starts with a known dial code, pre-populate selected country & input number
    if (value) {
      const sortedDialCodes = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
      const match = sortedDialCodes.find(c => value.startsWith(c.dial));
      if (match) {
        setSelectedCountry(match);
        setNumber(value.slice(match.dial.length));
      }
    }
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
            <div className="p-2 border-b">
              <input
                autoFocus
                className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search country or code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
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

      <input
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

function MapEventsHandler({ onMapClick, targetCoords }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (targetCoords) {
      map.setView(targetCoords, 16);
    }
  }, [targetCoords, map]);

  return null;
}

export default function SubmitProperty() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', price_usd: '', price_mxn: '',
    bedrooms: '', bathrooms: '', neighborhood: '', address: '',
    furnished: 'furnished', pet_friendly: false, rental_type: 'long_term',
    availability_date: '', lease_terms: '', deposit_amount: '',
    whatsapp: '', contact_email: '', video_url: '', photos: [],
    agent_name: '', agent_email: '', agent_phone: '',
    owner_name: '', owner_phone: '',
    latitude: '', longitude: '',
    city: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [ownerEmailError, setOwnerEmailError] = useState('');
  const [ownerEmailChecking, setOwnerEmailChecking] = useState(false);
  const ownerEmailCheckRef = React.useRef(null);
  const [videoUrlError, setVideoUrlError] = useState('');

  const [addressLoading, setAddressLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [mapTargetCoords, setMapTargetCoords] = useState(null);

  const handleAddressSearch = async () => {
    const neighborhoodObj = NEIGHBORHOODS.find(n => n.value === form.neighborhood);
    const neighborhoodLabel = neighborhoodObj ? neighborhoodObj.label : '';
    const searchString = [form.address, neighborhoodLabel, 'Mexico'].filter(Boolean).join(', ');
    if (!searchString.trim()) return;

    setAddressLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchString)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'PVVerifiedRentalsSubmitPropertyPage'
        }
      });
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          setMapTargetCoords([lat, lon]);
          update('latitude', lat);
          update('longitude', lon);
          toast.success('Address location found!');
        } else {
          toast.error('Address location not found on map.');
        }
      } else {
        toast.error('Search failed.');
      }
    } catch (err) {
      console.error('Nominatim search failed', err);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleCitySearch = async () => {
    if (!form.city.trim()) return;
    setCityLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.city.trim() + ', Mexico')}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'PVVerifiedRentalsSubmitPropertyPage'
        }
      });
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          setMapTargetCoords([lat, lon]);
          update('latitude', lat);
          update('longitude', lon);
          toast.success('City center found!');
        } else {
          toast.error('City not found.');
        }
      } else {
        toast.error('Search failed.');
      }
    } catch (err) {
      console.error('Nominatim search failed', err);
    } finally {
      setCityLoading(false);
    }
  };

  const validateVideoUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    const youtubeRe = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/i;
    const vimeoRe = /^(https?:\/\/)?(www\.)?vimeo\.com\//i;
    const directVideoRe = /\.(mp4|webm|ogg)(\?.*)?$/i;
    if (youtubeRe.test(trimmed) || vimeoRe.test(trimmed) || directVideoRe.test(trimmed)) return '';
    return 'Please enter a valid YouTube, Vimeo, or direct video URL (.mp4, .webm, .ogg).';
  };

  const getVideoEmbedUrl = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  };

  const { data: subscription = null, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () =>
      user?.id
        ? base44.entities.Subscription.filter({ user_id: user.id }).then(data => data[0] || null)
        : Promise.resolve(null),
    enabled: !!user?.id,
  });

  const { data: verification = null, isLoading: isLoadingVerification } = useQuery({
    queryKey: ['verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('verifications')
        .select('id_verification')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    enabled: !!user?.id,
  });

  const isIdVerified = user?.id_verified || verification?.id_verification === 'approved';

  // Owners and agents do not require an active subscription to list properties.
  // Only renters require an active subscription.
  const hasActiveSubscription = user?.role === 'renter'
    ? isSubscriptionActive(subscription)
    : true;

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u.role === 'agent') {
        // Agent listing on behalf of owner: auto-fill agent's own info in agent section
        // Owner contact info (Contact Info section) stays empty for agent to fill in
        setForm(prev => ({
          ...prev,
          agent_name: u.full_name || '',
          agent_email: u.email || '',
          agent_phone: u.phone_number || '',
        }));
      } else {
        // Owner/other roles listing their own property: pre-fill owner contact info
        setForm(prev => ({
          ...prev,
          contact_email: u.email || '',
          whatsapp: u.phone_number || '',
          owner_phone: u.phone_number || '',
          owner_name: u.full_name || '',
        }));
      }
    }).catch(() => { });
  }, []);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);

    setUploadError(null);
    if (!files.length) return;

    const allowedFiles = [];
    const rejectedFiles = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isGif = file.type === 'image/gif' || lowerName.endsWith('.gif');
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|ogg)$/i.test(lowerName);
      const isImage = file.type.startsWith('image/') || lowerName.endsWith('.jfif');
      const isAllowedExtension = /\.(jpe?g|png|webp|avif|jfif)$/i.test(lowerName);

      if (!isImage || !isAllowedExtension || isGif || isVideo) {
        rejectedFiles.push(file.name);
        continue;
      }
      allowedFiles.push(file);
    }

    if (rejectedFiles.length) {
      const message = `Skipped invalid uploads: ${rejectedFiles.join(', ')}. Only JPG, JPEG, JFIF, PNG, WebP, and AVIF images are allowed.`;
      console.warn(message);
      toast.error(message);
    }

    const remainingSlots = 8 - form.photos.length;
    if (remainingSlots <= 0) {
      const message = 'You can upload a maximum of 8 photos.';
      setUploadError(message);
      toast.error(message);
      return;
    }

    const uploadFiles = allowedFiles.slice(0, remainingSlots);
    if (uploadFiles.length < allowedFiles.length) {
      toast.error('Only the first 8 allowed photos will be uploaded.');
    }

    if (!uploadFiles.length) return;

    setUploading(true);
    try {
      const urls = [];
      for (const file of uploadFiles) {

        const result = await base44.integrations.Core.UploadFile({ file });

        const file_url = result?.file_url;
        if (!file_url) {
          throw new Error('Upload returned no file_url');
        }
        urls.push(file_url);
      }
      update('photos', [...form.photos, ...urls]);
    } catch (err) {
      console.error('Photo upload failed', err);
      const message = err?.message || err?.error || 'Photo upload failed.';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    update('photos', form.photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    if ((user.role === 'owner' || user.role === 'agent') && !isIdVerified) {
      toast.error('Complete identity verification before submitting a property.');
      return;
    }
    // Only enforce subscription requirement for renters
    if (user?.role === 'renter' && !hasActiveSubscription) {
      toast.error('You need an active subscription to submit a property. Please subscribe first.');
      return;
    }
    if (!user?.stripe_onboarding_complete || !user?.stripe_connect_id) {
      toast.error('Please connect Stripe first to receive payments');
      return;
    }
    if (uploading) {
      toast.error('Please wait until photo upload is finished before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      // Validate: if agent_email is provided, check it exists in DB AND has an 'agent' role (case-insensitive)
      if (form.agent_email) {
        const trimmedEmail = form.agent_email.trim();
        const { data: agentProfiles, error: agentError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', trimmedEmail);

        if (agentError) {
          throw new Error('Failed to verify agent email: ' + agentError.message);
        }

        const agentUser = agentProfiles?.find(p => p.role === 'agent');
        if (!agentUser) {
          throw new Error(`Agent email "${form.agent_email}" not found or is not registered as an agent in our system.`);
        }
      }

      // Check subscription limits for agents
      if (user.role === 'agent') {
        const subscriptions = await base44.entities.Subscription.filter({ user_id: user.id });
        const activeSub = subscriptions.find(s => s.status === 'active');

        if (activeSub) {
          // Count current active listings for this agent
          const myListings = await base44.entities.Listing.filter({ owner_email: user.email });
          const activeListings = myListings.filter(l => l.status !== 'archived').length;

          if (activeSub.plan === 'basic' && activeListings >= 5) {
            throw new Error('Basic plan allows up to 5 active listings. Please upgrade to Pro for unlimited listings.');
          }
        }

        // Validate: owner email must not belong to any agent-role user
        if (!form.contact_email) {
          throw new Error('Please enter the owner\'s email address.');
        }
        const trimmedOwnerEmail = form.contact_email.trim();
        const { data: ownerProfiles, error: ownerError } = await supabase
          .from('profiles')
          .select('id, role')
          .ilike('email', trimmedOwnerEmail);

        if (ownerError) {
          throw new Error('Failed to verify owner email: ' + ownerError.message);
        }

        const ownerUser = ownerProfiles?.[0];
        if (!ownerUser) {
          throw new Error(`Owner email "${form.contact_email}" not found. The owner must have an existing profile in the system.`);
        }
        if (ownerUser.role === 'agent') {
          throw new Error(`The email "${form.contact_email}" belongs to an agent. Please enter a valid property owner email.`);
        }
      }

      // Determine owner info: for agents, use what they entered; for owners, use their own profile
      const ownerEmail = user.role === 'agent' ? (form.contact_email || form.agent_email) : user.email;
      const ownerName = user.role === 'agent' ? form.owner_name : user.full_name;
      const ownerPhone = user.role === 'agent' ? (form.owner_phone || form.whatsapp || '') : (form.owner_phone || user.phone_number || '');

      // Resolve latitude and longitude coordinates based on neighborhood to perform Overpass API queries
      const NEIGHBORHOOD_COORDS = {
        boca_de_tomatlan: [20.5186, -105.3129],
        mismaloya: [20.5317, -105.2892],
        garza_blanca: [20.5593, -105.2673],
        playas_gemelas: [20.5678, -105.2635],
        sierra_del_mar: [20.5702, -105.2575],
        conchas_chinas: [20.5878, -105.2311],
        amapas: [20.5960, -105.2355],
        romantica: [20.6025, -105.2372],
        centro: [20.6120, -105.2335],
        cinco_de_diciembre: [20.6225, -105.2320],
        versalles: [20.6355, -105.2315],
        las_glorias: [20.6288, -105.2356],
        fluvial: [20.6405, -105.2285],
        el_caloso: [20.6085, -105.2232],
        hotel_zone: [20.6300, -105.2410],
        marina_vallarta: [20.6653, -105.2536],
        north_vallarta: [20.6785, -105.2345],
        pitillal: [20.6489, -105.2132],
        nuevo_vallarta: [20.6922, -105.2891],
        flamingos: [20.7185, -105.3054],
        bucerias: [20.7554, -105.3323],
        la_cruz: [20.7297, -105.3789],
        punta_mita: [20.7681, -105.5264],
        sayulita: [20.8689, -105.4408],
      };

      const coords = NEIGHBORHOOD_COORDS[form.neighborhood] || [20.6534, -105.2253];
      const latitude = form.latitude ? Number(form.latitude) : coords[0];
      const longitude = form.longitude ? Number(form.longitude) : coords[1];

      let nearbyPlaces = [];
      try {
        const query = `[out:json];
        (
          node(around:10000,${latitude},${longitude})["tourism"~"attraction|museum|viewpoint"];
          node(around:10000,${latitude},${longitude})["amenity"~"bank|gym|beauty|cinema|mall|supermarket|company|theatre|office"];
          node(around:10000,${latitude},${longitude})["leisure"~"fitness_centre|cinema|theatre"];
          node(around:10000,${latitude},${longitude})["shop"~"mall|supermarket|beauty"];
          node(around:10000,${latitude},${longitude})["aeroway"~"aerodrome|terminal"];
          node(around:10000,${latitude},${longitude})["railway"~"station|halt"];
          node(around:10000,${latitude},${longitude})["amenity"~"bus_station"];
        );
        out;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.elements)) {
            // Filter elements that have a valid name and are not parks/parking
            const validElements = data.elements.filter(el => {
              const name = el.tags?.name;
              const type = (el.tags?.amenity || el.tags?.leisure || el.tags?.tourism || el.tags?.shop || el.tags?.aeroway || el.tags?.railway || '').toLowerCase();
              return name && name.trim().length > 0 && type !== 'parking' && type !== 'park' && !name.toLowerCase().includes('parking');
            });

            // Map and limit to top 15 clean results
            nearbyPlaces = validElements.slice(0, 15).map(el => {
              const type = el.tags?.aeroway || el.tags?.railway || el.tags?.tourism || el.tags?.amenity || el.tags?.leisure || el.tags?.shop || 'Attraction';
              return {
                name: el.tags?.name,
                type: type,
                lat: el.lat,
                lon: el.lon,
                distance: 'Nearby'
              };
            });
          }
        }
      } catch (osmErr) {
        console.warn('OSM fetch failed', osmErr);
      }

      const { city: formCity, ...listingData } = form;

      await base44.entities.Listing.create({
        ...listingData,
        price_mxn: Number(form.price_mxn),
        price_usd: form.price_usd ? Number(form.price_usd) : Math.round(Number(form.price_mxn) / 17.5),
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : undefined,
        status: 'pending',
        owner_email: ownerEmail,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        nearby_places: nearbyPlaces,
        latitude: latitude,
        longitude: longitude,
      });
      toast.success('Property submitted successfully! It will be reviewed shortly.');
      setSubmitted(true);
    } catch (err) {
      console.error('Listing creation failed', err);
      toast.error(err?.message || 'Failed to save property.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold">Property Submitted!</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Your listing is pending review. Our team will verify and publish it shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">List Your Property</h1>
        <p className="text-muted-foreground mt-2">Submit your rental for verification and reach thousands of renters.</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800 mb-6 leading-relaxed shadow-sm font-medium">
        🛡️ <span className="font-bold">Protected Lead Policy:</span> Any tenant introduced through PV Verified Rentals is deemed a Protected Lead. If the owner enters into a lease with that tenant, or any person introduced by that tenant, during the protection period, the agreed commission and platform fee remain payable, regardless of whether the lease is completed through the platform or directly.
      </div>

      {user && (user.role === 'owner' || user.role === 'agent') && !isLoadingVerification && !isIdVerified && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-6">
          Your identity must be verified before you can submit a property. Please complete verification and try again.
        </div>
      )}

      {user && user.role === 'renter' && !isLoadingSubscription && !hasActiveSubscription && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 mb-6">
          An active subscription is required to submit a property. Please visit the Pricing page to subscribe.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input required value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g., Stunning Ocean View 2BR in Romántica" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={4} placeholder="Describe the property, amenities, and what makes it special..." />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Monthly Rent (MXN) *</Label>
                <Input required type="number" value={form.price_mxn} onChange={e => update('price_mxn', e.target.value)} />
              </div>
              {/* <div>
                <Label>Monthly Rent (USD)</Label>
                <Input type="number" value={form.price_usd} onChange={e => update('price_usd', e.target.value)} />
              </div> */}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bedrooms *</Label>
                <Input required type="number" value={form.bedrooms} onChange={e => update('bedrooms', e.target.value)} />
              </div>
              <div>
                <Label>Bathrooms *</Label>
                <Input required type="number" value={form.bathrooms} onChange={e => update('bathrooms', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Neighborhood *</Label>
                <Select required value={form.neighborhood} onValueChange={v => update('neighborhood', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {GROUPED_NEIGHBORHOODS.map(group => (
                      <React.Fragment key={group.label}>
                        <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase bg-muted/40 tracking-wider">
                          {group.label}
                        </div>
                        {group.options.map(o => (
                          <SelectItem key={o.value} value={o.value} className="pl-4">
                            {o.label}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Furnished</Label>
                <Select value={form.furnished} onValueChange={v => update('furnished', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FURNISHED_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.address}
                    onChange={e => update('address', e.target.value)}
                    placeholder="Street, number, colonia..."
                    className="flex-1"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddressSearch();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddressSearch}
                    disabled={addressLoading}
                  >
                    {addressLoading ? '...' : 'Find Address'}
                  </Button>
                </div>
              </div>
              <div>
                <Label>City</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    placeholder="e.g. Puerto Vallarta"
                    className="flex-1"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCitySearch();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleCitySearch}
                    disabled={cityLoading}
                  >
                    {cityLoading ? '...' : 'Find City'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Map coordinate pin drop */}
            <div className="space-y-2">
              <Label>Pinpoint Location * (Click on map to drop pin)</Label>
              <div className="h-64 rounded-xl border border-slate-200 overflow-hidden relative z-10">
                <MapContainer
                  center={
                    form.latitude && form.longitude
                      ? [Number(form.latitude), Number(form.longitude)]
                      : [20.6534, -105.2253]
                  }
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapEventsHandler
                    onMapClick={(lat, lng) => {
                      update('latitude', lat);
                      update('longitude', lng);
                    }}
                    targetCoords={mapTargetCoords}
                  />
                  {form.latitude && form.longitude && (
                    <Marker position={[Number(form.latitude), Number(form.longitude)]} />
                  )}
                </MapContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>Latitude: {form.latitude || 'Not set'}</div>
                <div>Longitude: {form.longitude || 'Not set'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rental Type</Label>
                <Select value={form.rental_type} onValueChange={v => update('rental_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RENTAL_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch id="pet" checked={form.pet_friendly} onCheckedChange={v => update('pet_friendly', v)} />
                <Label htmlFor="pet">Pet Friendly</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Available From</Label>
                <Input type="date" value={form.availability_date} onChange={e => update('availability_date', e.target.value)} />
              </div>
              <div>
                <Label>Deposit (MXN)</Label>
                <Input type="number" value={form.deposit_amount} onChange={e => update('deposit_amount', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Lease Terms (Months)</Label>
              <Input type="number" min="1" value={form.lease_terms} onChange={e => update('lease_terms', e.target.value)} placeholder="e.g., 12" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos & Video</CardTitle>
            <CardDescription>Upload property photos and video walkthrough</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Photos</Label>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : (
                    <>
                      <Plus className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Add Photos (max 8)</span>
                    </>
                  )}
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif,image/jfif" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>
            {form.photos.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-muted-foreground/20">
                <p className="text-xs font-semibold text-muted-foreground">Uploaded image URLs</p>
                <div className="space-y-1 text-xs text-blue-600">
                  {form.photos.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noreferrer" className="block break-all hover:underline">
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {uploadError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}
            <div>
              <Label>Video Walkthrough URL</Label>
              <Input
                value={form.video_url}
                onChange={e => {
                  const val = e.target.value;
                  update('video_url', val);
                  setVideoUrlError(validateVideoUrl(val));
                }}
                placeholder="YouTube, Vimeo, or direct video link (.mp4, .webm)"
              />
              {videoUrlError && (
                <p className="text-xs text-red-600 mt-1 font-medium">{videoUrlError}</p>
              )}
              {form.video_url && !videoUrlError && (() => {
                const embedUrl = getVideoEmbedUrl(form.video_url);
                if (embedUrl) return (
                  <div className="mt-2 rounded-xl overflow-hidden border aspect-video">
                    <iframe src={embedUrl} title="Video preview" className="w-full h-full" allow="fullscreen" />
                  </div>
                );
                return (
                  <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Valid video URL
                  </p>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{user?.role === 'agent' ? 'Owner Contact Info' : 'Contact Info'}</CardTitle>
            <CardDescription>{user?.role === 'agent' ? 'Enter the property owner\'s contact details' : 'Your contact details for this listing'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.role === 'agent' && (
              <div>
                <Label>Owner Name *</Label>
                <Input value={form.owner_name} onChange={e => update('owner_name', e.target.value)} placeholder="e.g., Maria Garcia" />
              </div>
            )}
            <div>
              <Label>Phone Number</Label>
              <div className={user?.role !== 'agent' ? "opacity-60 pointer-events-none" : ""}>
                <PhoneInput
                  value={form.whatsapp}
                  onChange={(val) => update('whatsapp', val)}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                disabled={user?.role !== 'agent'}
                type="email"
                value={form.contact_email}
                onChange={e => {
                  const val = e.target.value;
                  update('contact_email', val);
                  setOwnerEmailError('');

                  if (user?.role !== 'agent') return;

                  // Debounced Supabase check
                  if (ownerEmailCheckRef.current) clearTimeout(ownerEmailCheckRef.current);
                  const trimmed = val.trim();
                  if (!trimmed || !trimmed.includes('@')) return;

                  ownerEmailCheckRef.current = setTimeout(async () => {
                    setOwnerEmailChecking(true);
                    try {
                      const { data } = await supabase
                        .from('profiles')
                        .select('role')
                        .ilike('email', trimmed)
                        .maybeSingle();
                      if (data?.role === 'agent') {
                        setOwnerEmailError('This email belongs to an agent. Owner email must belong to a property owner, not an agent.');
                      } else {
                        setOwnerEmailError('');
                      }
                    } catch (_) {
                      // silently ignore lookup errors
                    } finally {
                      setOwnerEmailChecking(false);
                    }
                  }, 600);
                }}
              />
              {ownerEmailChecking && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking email...
                </p>
              )}
              {ownerEmailError && !ownerEmailChecking && (
                <p className="text-xs text-red-600 mt-1 font-medium">{ownerEmailError}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{user?.role === 'agent' ? 'Agent Contact' : 'Agent Contact (Optional)'}</CardTitle>
            <CardDescription>{user?.role === 'agent' ? 'Your details representing this listing' : 'Choose your agent representing your property'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Agent Name</Label>
              <Input disabled={user?.role === 'agent'} value={form.agent_name} onChange={e => update('agent_name', e.target.value)} placeholder="e.g., Juan Perez" />
            </div>
            <div>
              <Label>Agent Email</Label>
              <Input disabled={user?.role === 'agent'} type="email" value={form.agent_email} onChange={e => update('agent_email', e.target.value)} placeholder="agent@example.com" />
            </div>
            <div>
              <Label>Agent Phone</Label>
              <Input
                disabled={user?.role === 'agent'}
                type="number"
                value={form.agent_phone}
                onChange={e => update('agent_phone', e.target.value.slice(0, 10))}
                placeholder="3221234567"
              />
            </div>
          </CardContent>
        </Card>

        {/* Show owner info summary for agents at the end */}
        {user?.role === 'agent' && (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-base">Owner Info Summary</CardTitle>
              <CardDescription>This owner information will be shown on the listing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Owner Name:</span>
                <span className="ml-2 font-medium">{form.owner_name || 'Not set'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Owner Email:</span>
                <span className="ml-2 font-medium">{form.contact_email || 'Not set'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Owner Phone:</span>
                <span className="ml-2 font-medium">{form.whatsapp || form.owner_phone || 'Not provided'}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting || uploading || !hasActiveSubscription}>
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />)}
          {uploading ? 'Uploading photos...' : (submitting ? 'Submitting...' : 'Submit for Review')}
        </Button>
      </form>
    </div>
  );
}