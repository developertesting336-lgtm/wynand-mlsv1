import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User, Mail, Phone, Shield, Loader2, Pencil, Building2, Calendar, Upload } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { storageIntegration } from '@/lib/auth';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone_number: '' });
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({ full_name: u.full_name || '', phone_number: u.phone_number || '' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingData(true);
    // load verification record to read profile_photo if present
    supabase.from('verifications').select('*').eq('user_id', user.id).maybeSingle().then(res => {
      if (!res.error) setVerification(res.data || null);
    }).catch(() => {});
    Promise.all([
      // Fetch bookings with listing and agreement data if renter
      user.role === 'renter' ? supabase.from('bookings').select('*, listings(title, price_usd), agreement_conditions').eq('renter_id', user.id).order('created_date', { ascending: false }) : Promise.resolve({ data: [] }),
      // Fetch properties if owner/agent
      (user.role === 'owner' || user.role === 'agent') ? supabase.from('listings').select('*').eq('owner_email', user.email).order('created_date', { ascending: false }) : Promise.resolve({ data: [] }),
    ]).then(([bookingsRes, propsRes]) => {
      setBookings(bookingsRes.data || []);
      setProperties(propsRes.data || []);
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, [user?.id, user?.email, user?.role]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: form.full_name, phone_number: form.phone_number })
        .eq('id', user.id);

      if (error) throw error;

      setUser(prev => ({ ...prev, ...form }));
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      toast.success('Profile updated successfully');
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const profilePhotoUrl = verification?.profile_photo || user?.photo_url || null;

  const handleProfilePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await storageIntegration.UploadFile({ file, folder: 'Profile' });
      // upsert into verifications.profile_photo (do not modify profiles table)
      const { data: vData, error: vErr } = await supabase
        .from('verifications')
        .upsert({ user_id: user.id, profile_photo: file_url, updated_date: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
      if (vErr) throw vErr;

      // update local state
      if (vData) setVerification(vData);
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      try { window.dispatchEvent(new Event('app:user-updated')); } catch (e) {}
      toast.success('Profile photo updated');
    } catch (err) {
      console.error('Failed to upload profile photo:', err);
      toast.error('Failed to upload profile photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <User className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Please sign in</h2>
        <p className="text-muted-foreground text-sm">You need to be logged in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Profile Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" /> My Profile
          </CardTitle>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Pencil className="w-4 h-4" /> Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={form.phone_number}
                    onChange={e => setForm(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="+52 123 456 7890"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span> : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                {profilePhotoUrl ? (
                  <AvatarImage src={profilePhotoUrl} alt="Profile photo" />
                ) : (
                  <AvatarFallback>{user?.full_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{user.full_name || 'Your profile'}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div>
              <label className="cursor-pointer inline-flex">
                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePhoto} />
                <Button size="sm" className="gap-1.5" disabled={uploadingPhoto} asChild>
                  <span>
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingPhoto ? 'Uploading...' : 'Upload/Replace Photo'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Full Name</p>
              <p className="text-sm font-medium">{user.full_name || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone Number</p>
              <p className="text-sm font-medium">{user.phone_number || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Role</p>
              <p className="text-sm font-medium capitalize">{user.role || 'renter'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <Shield className="w-3.5 h-3.5" />
            {user.id_verified ? 'Identity Verified' : 'Identity Not Verified'}
          </div>
        </CardContent>
      </Card>

      {/* Bookings Section (for renters) */}
      {user.role === 'renter' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> My Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => {
                  const conditions = b.agreement_conditions || {};
                  const property = b.listings || {};
                  const monthlyRent = conditions.monthlyRent || `$${property.price_usd?.toLocaleString() || 'N/A'}`;
                  const securityDeposit = conditions.securityDepositAmount ? `$${Number(conditions.securityDepositAmount).toLocaleString()}` : 'N/A';
                  const agreementDate = conditions.landlordSignatureDate || b.created_date ? new Date(b.created_date).toLocaleDateString() : 'N/A';
                  
                  return (
                    <div key={b.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{property.title || 'Property Booking'}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          b.status === 'approved' ? 'bg-green-100 text-green-700' :
                          b.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-muted-foreground/70">Move-in Date</span>
                          <span className="font-medium text-foreground">{b.move_in_date || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Monthly Rent</span>
                          <span className="font-medium text-foreground">{monthlyRent}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Security Deposit</span>
                          <span className="font-medium text-foreground">{securityDeposit}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Agreement Date</span>
                          <span className="font-medium text-foreground">{agreementDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Properties Section (for owners/agents) */}
      {(user.role === 'owner' || user.role === 'agent') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> My Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No properties listed yet</p>
            ) : (
              <div className="space-y-3">
                {properties.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{p.title || 'Untitled Property'}</p>
                      <p className="text-xs text-muted-foreground">{p.neighborhood || 'No location'} · ${p.price_usd?.toLocaleString()}/mo</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      p.status === 'approved' ? 'bg-green-100 text-green-700' :
                      p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}