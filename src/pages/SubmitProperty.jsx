import React, { useState, useEffect } from 'react';
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
import { NEIGHBORHOODS, FURNISHED_OPTIONS, RENTAL_TYPES } from '@/lib/constants';

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
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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

  const hasActiveSubscription = (user?.role === 'owner' || user?.role === 'agent')
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
    }).catch(() => {});
  }, []);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    console.log('handlePhotoUpload files', files);
    setUploadError(null);
    if (!files.length) return;

    const allowedFiles = [];
    const rejectedFiles = [];

    for (const file of files) {
        const lowerName = file.name.toLowerCase();
        const isGif = file.type === 'image/gif' || lowerName.endsWith('.gif');
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|ogg)$/i.test(lowerName);
        const isImage = file.type.startsWith('image/');
        const isAllowedExtension = /\.(jpe?g|png|webp|avif)$/i.test(lowerName);

        if (!isImage || !isAllowedExtension || isGif || isVideo) {
          rejectedFiles.push(file.name);
          continue;
        }
        allowedFiles.push(file);
      }

      if (rejectedFiles.length) {
        const message = `Skipped invalid uploads: ${rejectedFiles.join(', ')}. Only JPG, PNG, WebP, and AVIF images are allowed.`;
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
        console.log('Uploading file', file.name, file.type, file.size);
        const result = await base44.integrations.Core.UploadFile({ file });
        console.log('Upload result', result);
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
    if (!hasActiveSubscription) {
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

        // Verify that the owner has an existing profile in the system
        if (!form.contact_email) {
          throw new Error('Please enter the owner\'s email address.');
        }
        const trimmedOwnerEmail = form.contact_email.trim();
        const { data: ownerProfiles, error: ownerError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', trimmedOwnerEmail);

        if (ownerError) {
          throw new Error('Failed to verify owner email: ' + ownerError.message);
        }

        const ownerUser = ownerProfiles?.[0];
        if (!ownerUser) {
          throw new Error(`Owner email "${form.contact_email}" not found. The owner must have an existing profile in the system.`);
        }
      }

      // Determine owner info: for agents, use what they entered; for owners, use their own profile
      const ownerEmail = user.role === 'agent' ? (form.contact_email || form.agent_email) : user.email;
      const ownerName = user.role === 'agent' ? form.owner_name : user.full_name;
      const ownerPhone = user.role === 'agent' ? (form.owner_phone || form.whatsapp || '') : (form.owner_phone || user.phone_number || '');

      await base44.entities.Listing.create({
        ...form,
        price_mxn: Number(form.price_mxn),
        price_usd: form.price_usd ? Number(form.price_usd) : Math.round(Number(form.price_mxn) / 17.5),
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : undefined,
        status: 'pending',
        owner_email: ownerEmail,
        owner_name: ownerName,
        owner_phone: ownerPhone,
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

      {user && (user.role === 'owner' || user.role === 'agent') && !isLoadingVerification && !isIdVerified && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-6">
          Your identity must be verified before you can submit a property. Please complete verification and try again.
        </div>
      )}

      {user && (user.role === 'owner' || user.role === 'agent') && !isLoadingSubscription && !hasActiveSubscription && (
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
                    {NEIGHBORHOODS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
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
            <div>
              <Label>Full Address</Label>
              <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Street, number, colonia..." />
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
              <Label>Lease Terms</Label>
              <Input value={form.lease_terms} onChange={e => update('lease_terms', e.target.value)} placeholder="e.g., 6-month minimum, 1 year preferred" />
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
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" onChange={handlePhotoUpload} className="hidden" />
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
              <Input value={form.video_url} onChange={e => update('video_url', e.target.value)} placeholder="YouTube, Vimeo, or other video link" />
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
              <Label>WhatsApp Number</Label>
              <Input value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+52 322 123 4567" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} />
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
              <Input disabled={user?.role === 'agent'} value={form.agent_phone} onChange={e => update('agent_phone', e.target.value)} placeholder="+52 322 123 4567" />
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