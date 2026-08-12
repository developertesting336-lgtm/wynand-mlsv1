import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { storageIntegration } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Upload, FileText, CheckCircle, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

export default function VerificationBlockingModal({ user, onComplete }) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Upload state variables
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingBank, setUploadingBank] = useState(false);

  const loadVerification = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) {
        setVerification(data);
      }
    } catch (err) {
      console.error('Failed to load verification record:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerification();
  }, [user?.id]);

  // Document states
  const profilePhotoUrl = verification?.profile_photo || user?.photo_url || null;
  const identityDocs = verification?.identity_documents || [];
  const idDocUrl = verification?.id_document_url || user?.id_document_url;
  const targetIdDocUrl = identityDocs.length > 0 ? identityDocs[0] : idDocUrl;
  const hasUploadedId = identityDocs.length > 0 || !!idDocUrl;
  const bankDocs = verification?.bank_documents || [];

  // 1. Upload profile photo
  const handleProfilePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await storageIntegration.UploadFile({ file, folder: 'Profile' });
      const payload = {
        user_id: user.id,
        profile_photo: file_url,
        updated_date: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      try { window.dispatchEvent(new Event('app:user-updated')); } catch (e) {}
      toast.success('Profile photo uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload profile photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 2. Upload ID card
  const handleIdUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(true);
    try {
      const { file_url } = await storageIntegration.UploadFile({ file, folder: 'Identity' });
      const currentDocs = verification?.identity_documents || [];
      const newDocs = [file_url, ...currentDocs];
      const payload = {
        ...verification,
        user_id: user.id,
        id_document_url: file_url, // For backwards compatibility
        identity_documents: newDocs,
        id_verification: 'new', // Needs admin verification
        updated_date: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      toast.success('ID Document uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload ID Document');
    } finally {
      setUploadingId(false);
    }
  };

  // 3. Upload bank details
  const handleBankUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBank(true);
    try {
      const { file_url } = await storageIntegration.UploadFile({ file, folder: 'bank-details' });
      const currentDocs = verification?.bank_documents || [];
      const newDocs = [file_url, ...currentDocs];
      const payload = {
        ...verification,
        user_id: user.id,
        id_document_url: idDocUrl || '', // met constraint
        bank_documents: newDocs,
        updated_date: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      toast.success('Bank details uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload Bank details');
    } finally {
      setUploadingBank(false);
    }
  };

  const deleteBankDoc = async (index) => {
    try {
      const currentDocs = verification?.bank_documents || [];
      const newDocs = currentDocs.filter((_, idx) => idx !== index);
      const payload = {
        ...verification,
        user_id: user.id,
        id_document_url: idDocUrl || '',
        bank_documents: newDocs,
        updated_date: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      toast.success('Bank document deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete document');
    }
  };

  // Complete and close modal
  const handleProceed = () => {
    if (!profilePhotoUrl) {
      toast.error('Please upload your Profile Photo first.');
      return;
    }
    if (!hasUploadedId) {
      toast.error('Please upload your Government-Issued ID Card.');
      return;
    }
    onComplete();
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="relative flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Complete Account Verification</h2>
              <p className="text-sm text-slate-500 mt-0.5">Please upload required documents to access your account</p>
            </div>
          </div>
          {profilePhotoUrl && hasUploadedId && (
            <button
              type="button"
              onClick={onComplete}
              className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* Section 1: Profile Photo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              1. Profile Photo <span className="text-red-500">*</span>
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  {profilePhotoUrl ? (
                    <AvatarImage src={profilePhotoUrl} />
                  ) : (
                    <AvatarFallback>{user?.full_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="text-xs font-medium text-slate-700">Clear Headshot</p>
                  <p className="text-[10px] text-slate-400">Must be a clear selfie or portrait photo</p>
                </div>
              </div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePhoto} disabled={uploadingPhoto} />
                <Button size="sm" variant={profilePhotoUrl ? "outline" : "default"} className="text-xs gap-1" asChild>
                  <span>
                    {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {profilePhotoUrl ? 'Replace' : 'Upload'}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Section 2: ID Card */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              2. Government-Issued ID Card <span className="text-red-500">*</span>
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${hasUploadedId ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">Passport / Driver's License / INE</p>
                  <p className="text-[10px] text-slate-400">Clear picture of front & back page</p>
                  {hasUploadedId && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-1">
                      <CheckCircle className="w-3 h-3" /> Document Uploaded
                    </span>
                  )}
                </div>
              </div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleIdUpload} disabled={uploadingId} />
                <Button size="sm" variant={hasUploadedId ? "outline" : "default"} className="text-xs gap-1" asChild>
                  <span>
                    {uploadingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {hasUploadedId ? 'Replace' : 'Upload'}
                  </span>
                </Button>
              </label>
            </div>
            {/* ID document visual preview */}
            {hasUploadedId && targetIdDocUrl && (
              <div className="mt-2 p-2 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden">
                {targetIdDocUrl.match(/\.(pdf)(\?.*)?$/i) ? (
                  <a href={targetIdDocUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5 p-2 font-medium">
                    <FileText className="w-4 h-4 text-slate-400" /> View Uploaded ID Document (PDF)
                  </a>
                ) : (
                  <img src={targetIdDocUrl} alt="Uploaded ID card" className="max-h-36 max-w-full rounded-md object-contain border" />
                )}
              </div>
            )}
          </div>

          {/* Section 3: Bank Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              3. Bank Details & Statements <span className="text-slate-400 font-normal">(Optional)</span>
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${bankDocs.length > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">Monthly bank statements</p>
                  <p className="text-[10px] text-slate-400">Upload to accelerate verification checks</p>
                </div>
              </div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBankUpload} disabled={uploadingBank} />
                <Button size="sm" variant="outline" className="text-xs gap-1" asChild>
                  <span>
                    {uploadingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </span>
                </Button>
              </label>
            </div>

            {/* List uploaded bank docs with mini visual previews */}
            {bankDocs.length > 0 && (
              <div className="grid grid-cols-1 gap-2 mt-2">
                {bankDocs.map((url, idx) => {
                  const fileName = url.split('/').pop().replace(/^\d+_\d+_(.+)$/, '$1') || `Doc ${idx + 1}`;
                  const isImage = !url.match(/\.(pdf)(\?.*)?$/i);
                  return (
                    <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border bg-slate-50 text-xs">
                      <div className="flex items-center justify-between">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold truncate max-w-[80%] flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{fileName}</span>
                        </a>
                        <button type="button" onClick={() => deleteBankDoc(idx)} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-slate-200 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isImage && (
                        <div className="flex justify-center border rounded-md p-1 bg-white">
                          <img src={url} alt={`Bank statement ${idx + 1}`} className="max-h-24 max-w-full rounded object-contain" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t pt-4">
          <Button size="lg" className="w-full text-sm font-semibold h-11" onClick={handleProceed}>
            Complete & Submit Verification
          </Button>
          <p className="text-[10px] text-slate-400 text-center mt-3">
            Admins will review your submitted files manually to activate full privileges.
          </p>
        </div>
      </div>
    </div>
  );
}
