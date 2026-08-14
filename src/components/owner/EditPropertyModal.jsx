import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Loader2, Upload, Trash2, Search, MapPin } from 'lucide-react';
import { NEIGHBORHOODS, FURNISHED_OPTIONS, RENTAL_TYPES, NEIGHBORHOOD_LABELS, GROUPED_NEIGHBORHOODS } from '@/lib/constants';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
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

function MapEventsHandler({ onMapClick, targetCoords }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  React.useEffect(() => {
    if (targetCoords) {
      map.setView(targetCoords, 16);
    }
  }, [targetCoords, map]);

  return null;
}

export default function EditPropertyModal({ listing, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    price_usd: listing.price_usd?.toString() || '',
    price_mxn: listing.price_mxn?.toString() || '',
    bedrooms: listing.bedrooms?.toString() || '',
    bathrooms: listing.bathrooms?.toString() || '',
    neighborhood: listing.neighborhood || '',
    address: listing.address || '',
    city: listing.city || '',
    latitude: listing.latitude || '',
    longitude: listing.longitude || '',
    furnished: listing.furnished || 'furnished',
    pet_friendly: listing.pet_friendly || false,
    rental_type: listing.rental_type || 'long_term',
    availability_date: listing.availability_date ? listing.availability_date.split('T')[0] : '',
    lease_terms: listing.lease_terms || '',
    deposit_amount: listing.deposit_amount?.toString() || '',
    whatsapp: listing.whatsapp || '',
    contact_email: listing.contact_email || listing.owner_email || '',
    video_url: listing.video_url || '',
    photos: listing.photos || [],
    agent_name: listing.agent_name || '',
    agent_email: listing.agent_email || '',
    agent_phone: listing.agent_phone || '',
    owner_name: listing.owner_name || '',
    owner_phone: listing.owner_phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [mapTargetCoords, setMapTargetCoords] = useState(listing.latitude ? [listing.latitude, listing.longitude] : null);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

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
          'User-Agent': 'PVVerifiedRentalsEditPropertyModal'
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
    if (!form.city || !form.city.trim()) return;
    setCityLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.city.trim() + ', Mexico')}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'PVVerifiedRentalsEditPropertyModal'
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

  const updateListing = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Listing.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-listings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-listings'] });
      toast.success('Property updated successfully!');
      onClose();
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update property.');
    },
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
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
      toast.error(`Skipped invalid uploads: ${rejectedFiles.join(', ')}. Only JPG, JPEG, JFIF, PNG, WebP, and AVIF images are allowed.`);
    }

    const remainingSlots = 8 - form.photos.length;
    if (remainingSlots <= 0) {
      toast.error('You can upload a maximum of 8 photos.');
      return;
    }

    const uploadFiles = allowedFiles.slice(0, remainingSlots);
    if (!uploadFiles.length) return;

    setUploading(true);
    try {
      const urls = [];
      for (const file of uploadFiles) {
        const result = await base44.integrations.Core.UploadFile({ file });
        const file_url = result?.file_url;
        if (file_url) urls.push(file_url);
      }
      update('photos', [...form.photos, ...urls]);
    } catch (err) {
      toast.error(err?.message || 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    update('photos', form.photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      toast.error('Please wait until photo upload is finished.');
      return;
    }
    setSaving(true);
    try {
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
            const validElements = data.elements.filter(el => {
              const name = el.tags?.name;
              const type = (el.tags?.amenity || el.tags?.leisure || el.tags?.tourism || el.tags?.shop || el.tags?.aeroway || el.tags?.railway || '').toLowerCase();
              return name && name.trim().length > 0 && type !== 'parking' && type !== 'park' && !name.toLowerCase().includes('parking');
            });

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

      const { city: formCity, ...formDataToSend } = form;

      await updateListing.mutateAsync({
        id: listing.id,
        data: {
          ...formDataToSend,
          price_usd: Number(form.price_usd),
          price_mxn: form.price_mxn ? Number(form.price_mxn) : null,
          bedrooms: Number(form.bedrooms),
          bathrooms: Number(form.bathrooms),
          deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
          pet_friendly: form.pet_friendly,
          agent_name: form.agent_name || null,
          agent_email: form.agent_email || null,
          agent_phone: form.agent_phone || null,
          owner_name: form.owner_name || null,
          owner_phone: form.owner_phone || null,
          owner_email: user?.role === 'agent' ? (form.contact_email || form.agent_email) : user?.email,
          latitude: latitude,
          longitude: longitude,
          nearby_places: nearbyPlaces,
        },
      });
    } catch {
      // error handled in mutation
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-900 rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold">Edit Property</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{listing.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Info</h3>
            <div>
              <Label>Title *</Label>
              <Input required value={form.title} onChange={e => update('title', e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rent (USD) *</Label>
                <Input required type="number" value={form.price_usd} onChange={e => update('price_usd', e.target.value)} />
              </div>
              <div>
                <Label>Rent (MXN)</Label>
                <Input type="number" value={form.price_mxn} onChange={e => update('price_mxn', e.target.value)} />
              </div>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    {FURNISHED_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Address</Label>
                <div className="flex gap-2">
                  <Input 
                    value={form.address} 
                    onChange={e => update('address', e.target.value)} 
                    placeholder="e.g. Calle Febronio Uribe 123"
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
                    {addressLoading ? '...' : 'Find'}
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
                    {cityLoading ? '...' : 'Find'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Map Pin Dropper */}
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
                    {RENTAL_TYPES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch id="edit-pet" checked={form.pet_friendly} onCheckedChange={v => update('pet_friendly', v)} />
                <Label htmlFor="edit-pet">Pet Friendly</Label>
              </div>
            </div>
          </div>

          {/* Lease & Availability */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Lease & Availability</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Available From</Label>
                <Input type="date" value={form.availability_date} onChange={e => update('availability_date', e.target.value)} />
              </div>
              <div>
                <Label>Deposit (USD)</Label>
                <Input type="number" value={form.deposit_amount} onChange={e => update('deposit_amount', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Lease Terms (Months)</Label>
              <Input type="number" min="1" value={form.lease_terms} onChange={e => update('lease_terms', e.target.value)} placeholder="e.g., 12" />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Photos</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {form.photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
              {form.photos.length < 8 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Add photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/avif,image/jfif"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {user?.role === 'agent' ? 'Owner & Agent Contact' : 'Contact'}
            </h3>
            {user?.role === 'agent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Owner Name *</Label>
                  <Input value={form.owner_name} onChange={e => update('owner_name', e.target.value)} placeholder="e.g., Maria Garcia" />
                </div>
                <div>
                  <Label>Owner Phone</Label>
                  <Input value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} placeholder="+52 322 123 4567" />
                </div>
              </div>
            )}
            <div>
              <Label>{user?.role === 'agent' ? 'Owner WhatsApp' : 'WhatsApp'}</Label>
              <Input value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} />
            </div>
            <div>
              <Label>{user?.role === 'agent' ? 'Owner Email' : 'Contact Email'}</Label>
              <Input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} />
            </div>
            <div>
              <Label>Video Walkthrough URL</Label>
              <Input value={form.video_url} onChange={e => update('video_url', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <Label>Agent Name</Label>
                <Input disabled={user?.role === 'agent'} value={form.agent_name} onChange={e => update('agent_name', e.target.value)} />
              </div>
              <div>
                <Label>Agent Email</Label>
                <Input disabled={user?.role === 'agent'} type="email" value={form.agent_email} onChange={e => update('agent_email', e.target.value)} />
              </div>
              <div>
                <Label>Agent Phone</Label>
                <Input disabled={user?.role === 'agent'} value={form.agent_phone} onChange={e => update('agent_phone', e.target.value)} />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-2xl">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || uploading}
            onClick={handleSubmit}
            className="gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}