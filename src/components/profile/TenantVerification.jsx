import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Upload, FileText, CheckCircle, AlertCircle, Loader2, ExternalLink, Building2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


function UploadDocRow({ icon: Icon, label, description, existingUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
      toast.success(`${label} uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to upload ${label}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${existingUrl ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {existingUrl && (
            <a href={existingUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
              <FileText className="w-3 h-3" /> View uploaded file
            </a>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {existingUrl ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-accent/10 text-accent border-0 gap-1 text-xs">
              <CheckCircle className="w-3 h-3" /> Uploaded
            </Badge>
            <label className="cursor-pointer">
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
              <Button size="sm" variant="outline" className="text-xs gap-1.5" asChild>
                <span>{uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Replace</span>
              </Button>
            </label>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
            <Button size="sm" className="gap-1.5" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </span>
            </Button>
          </label>
        )}
      </div>
    </div>
  );
}

function MultiUploadDocRow({ icon: Icon, label, description, documents = [], folder, onUploaded, onDeleted }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, folder });
      onUploaded(file_url);
      toast.success(`${label} uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to upload ${label}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-4 border-b last:border-0 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted text-muted-foreground rounded-lg shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="shrink-0">
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
            <Button size="sm" className="gap-1.5" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading…' : 'Upload File'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {documents && documents.length > 0 && (
        <div className="pl-11 flex flex-col gap-2">
          {documents.map((url, idx) => {
            const fileName = url.split('/').pop().replace(/^\d+_\d+_(.+)$/, '$1') || `Document ${idx + 1}`;
            return (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 text-xs">
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline font-medium truncate max-w-[80%]">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{fileName}</span>
                </a>
                <Button
                  size="icon"
                  type="button"
                  variant="ghost"
                  className="w-6 h-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleted(idx)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TenantVerification({ user, onUserUpdated }) {
  const queryClient = useQueryClient();
  const [verification, setVerification] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showSatModal, setShowSatModal] = useState(false);
  const [rfcInput, setRfcInput] = useState('');
  const [ciecInput, setCiecInput] = useState('');
  const [isSubmittingSat, setIsSubmittingSat] = useState(false);
  const [connectingPurpose, setConnectingPurpose] = useState(null);

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
      setLoadingRecord(false);
    }
  };

  useEffect(() => {
    loadVerification();
  }, [user?.id]);

  const idDocUrl = verification?.id_document_url || user?.id_document_url;
  const identityDocs = verification?.identity_documents || [];
  const targetIdDocUrl = identityDocs.length > 0 ? identityDocs[0] : idDocUrl;

  const employmentProofUrl = verification?.employment_proof_url || user?.employment_proof_url;
  const identityStatus = verification?.id_verification || 'new';
  const employmentVerificationStatus = verification?.employment_verification || 'pending';
  const employer_name = verification?.employer_name;
  const salary = Number(verification?.monthly_income || 0).toLocaleString();
  const isOwnerOrAgent = user?.role === 'owner' || user?.role === 'agent';


  const saveField = async (field, url) => {
    try {
      const payload = {
        user_id: user.id,
        id_document_url: field === 'id_document_url' ? url : (idDocUrl || ''),
        employment_proof_url: field === 'employment_proof_url' ? url : (employmentProofUrl || null),
        id_verification: field === 'id_document_url' ? 'new' : identityStatus,
        employment_verification: field === 'employment_proof_url' ? 'new' : employmentVerificationStatus,
        updated_date: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    } catch (err) {
      console.error('Error saving document:', err);
      toast.error('Failed to save document record');
    }
  };

  const saveFieldArray = async (field, arrayValue) => {
    try {
      const payload = {
        ...verification, // spread existing verification record fields
        user_id: user.id,
        id_document_url: idDocUrl || '', // Ensure NOT NULL constraint is met
        [field]: arrayValue,
        updated_date: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setVerification(data);
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    } catch (err) {
      console.error(`Error saving ${field}:`, err);
      toast.error('Failed to save document record');
    }
  };

  const addIdentityDoc = async (url) => {
    const currentDocs = verification?.identity_documents || [];
    const newDocs = [url, ...currentDocs];
    await saveFieldArray('identity_documents', newDocs);
  };

  const deleteIdentityDoc = async (index) => {
    const currentDocs = verification?.identity_documents || [];
    const newDocs = currentDocs.filter((_, idx) => idx !== index);
    await saveFieldArray('identity_documents', newDocs);
  };

  const addBankDoc = async (url) => {
    const currentDocs = verification?.bank_documents || [];
    const newDocs = [url, ...currentDocs];
    await saveFieldArray('bank_documents', newDocs);
  };

  const deleteBankDoc = async (index) => {
    const currentDocs = verification?.bank_documents || [];
    const newDocs = currentDocs.filter((_, idx) => idx !== index);
    await saveFieldArray('bank_documents', newDocs);
  };


  const handleSatSubmit = async (e) => {
    e.preventDefault();
    if (!rfcInput.trim()) {
      toast.error('RFC is required');
      return;
    }
    if (!ciecInput.trim()) {
      toast.error('CIEC password is required');
      return;
    }

    setShowSatModal(false);
    setConnectingPurpose('bank_statement');
    try {
      const res = await supabase.functions.invoke('belvo-bank', {
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.full_name || user.email,
          rfc: rfcInput,
          ciec: ciecInput,
          purpose: 'bank_statement',
        })
      });

      console.log(res);

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try { data = await res.json(); } catch { }
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // For financial statements, we don't have a connect_url, we just wait for data to be fetched
      if (data?.success) {
        toast.success('Financial statements connection initiated. Please wait while we fetch your data...');

        // Poll verification status to check when data is ready
        const pollVerification = setInterval(async () => {
          const { data: verData, error } = await supabase
            .from('verifications')
            .select('bank_statement_verification')
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) return;
          if (verData?.bank_statement_verification === 'approved') {
            clearInterval(pollVerification);
            setConnectingPurpose(null);
            loadVerification();
            toast.success('Financial statements verified successfully!');
          } else if (verData?.bank_statement_verification === 'declined') {
            clearInterval(pollVerification);
            setConnectingPurpose(null);
            loadVerification();
            toast.error('Financial statements verification was declined. Please try again.');
          }
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollVerification);
          setConnectingPurpose(null);
        }, 120000);
      } else {
        throw new Error('Failed to create financial statements link');
      }
    } catch (err) {
      console.error('Failed to connect financial statements:', err);
      toast.error(err.message || 'Failed to connect financial statements');
      setConnectingPurpose(null);
    }
  };

  const connectBank = async (purpose = 'bank_statement') => {
    if (!user?.id || !user?.email) {
      toast.error('Please log in to connect your account');
      return;
    }

    // For financial statements, we need RFC and CIEC
    if (purpose === 'bank_statement') {
      setRfcInput('');
      setCiecInput('');
      setShowSatModal(true);
      return;
    } else {
      // Employment verification (existing logic)
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        'about:blank',
        'Belvo Bank Connection',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      setConnectingPurpose(purpose);
      try {
        const functionName = "belvo-create-connection";
        const res = await supabase.functions.invoke(functionName, {
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.full_name || user.email,
            purpose: purpose,
          })
        });

        console.log(res);

        let data = res.data;
        if (res && typeof res.json === 'function') {
          try { data = await res.json(); } catch { }
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.connect_url) {
          if (popup) {
            popup.location.href = data.connect_url;
          }

          const columnToCheck = 'employment_verification';

          // Poll for popup closure or verification completion
          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              clearInterval(pollVerification);
              setConnectingPurpose(null);
              loadVerification();
            }
          }, 1000);

          // Poll verification status to auto-close when approved
          const pollVerification = setInterval(async () => {
            const { data: verData, error } = await supabase
              .from('verifications')
              .select(columnToCheck)
              .eq('user_id', user.id)
              .maybeSingle();
            if (error) return;
            if (verData?.[columnToCheck] === 'approved') {
              clearInterval(pollVerification);
              if (popup && !popup.closed) popup.close();
              clearInterval(checkClosed);
              setConnectingPurpose(null);
              loadVerification();
            }
          }, 1500);

          toast.success('Bank connection window opened. Please complete the process.');
        } else {
          throw new Error('No connection URL received');
        }
      } catch (err) {
        console.error('Failed to connect bank:', err);
        toast.error(err.message || 'Failed to connect bank account');
        if (popup) popup.close();
        setConnectingPurpose(null);
      }
    }
  };

  const startVerification = async () => {
    if (!targetIdDocUrl) {
      toast.error('Please upload your Government-Issued ID first.');
      return;
    }
    setVerifying(true);
    try {
      const res = await supabase.functions.invoke('veriff-verify', {
        body: JSON.stringify({
          userId: user.id,
          idDocumentUrl: targetIdDocUrl,
          employmentProofUrl: employmentProofUrl || null,
        })
      });

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try { data = await res.json(); } catch { }
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.verification?.veriff_session_url) {
        setVerification(data.verification);
        toast.success('Verification session started. You will receive updates automatically.');
      } else {
        throw new Error('Failed to start Veriff session');
      }
    } catch (err) {
      console.error('Failed to start Veriff verification:', err);
      toast.error(err.message || 'Verification initialization failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loadingRecord) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity Verification Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Identity Verification</h3>
        </div>

        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${identityStatus === 'approved'
          ? 'bg-accent/10 border-accent/20'
          : identityStatus === 'started'
            ? 'bg-amber-50 border-amber-200'
            : identityStatus === 'declined'
              ? 'bg-red-50 border-red-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
          {identityStatus === 'approved' ? (
            <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${identityStatus === 'started' ? 'text-amber-600' : identityStatus === 'declined' ? 'text-red-600' : 'text-slate-600'
              }`} />
          )}
          <div>
            <p className={`text-sm font-semibold ${identityStatus === 'approved' ? 'text-accent' : identityStatus === 'started' ? 'text-amber-700' : identityStatus === 'declined' ? 'text-red-700' : 'text-slate-700'
              }`}>
              {identityStatus === 'approved'
                ? 'Identity Verified'
                : identityStatus === 'started'
                  ? 'Verification in Progress'
                  : identityStatus === 'declined'
                    ? 'Verification Declined'
                    : 'Identity Verification Pending'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {identityStatus === 'approved'
                ? 'Your identity has been verified through Veriff.'
                : identityStatus === 'started'
                  ? 'Please complete the Veriff session. Results will update automatically.'
                  : identityStatus === 'declined'
                    ? 'Your identity verification was declined. Please re-upload valid documents.'
                    : 'Upload your Government-Issued ID to verify your identity.'}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <MultiUploadDocRow
              icon={FileText}
              label="Government-Issued ID"
              description="Passport, national ID, or driver's license (PDF, JPG, PNG)"
              documents={verification?.identity_documents || []}
              folder="identity"
              onUploaded={addIdentityDoc}
              onDeleted={deleteIdentityDoc}
            />
          </CardContent>
        </Card>

        {targetIdDocUrl && identityStatus !== 'approved' && (
          <div className="flex justify-end">
            <Button size="lg" onClick={startVerification} disabled={verifying} className="gap-2">
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {identityStatus === 'started' ? 'Resume Veriff Verification' : 'Verify Identity with Veriff'}
              <ExternalLink className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        )}
      </div>

      {!isOwnerOrAgent && (
        <>
          {/* Employment Verification Section (Belvo) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Employment Verification</h3>
            </div>

        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${employmentVerificationStatus === 'approved'
          ? 'bg-accent/10 border-accent/20'
          : employmentVerificationStatus === 'started'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
          }`}>
          {employmentVerificationStatus === 'approved' ? (
            <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${employmentVerificationStatus === 'started' ? 'text-amber-600' : 'text-slate-600'}`} />
          )}
          <div>
            <p className={`text-sm font-semibold ${employmentVerificationStatus === 'approved' ? 'text-accent' : employmentVerificationStatus === 'started' ? 'text-amber-700' : 'text-slate-700'}`}
            >
              {employmentVerificationStatus === 'approved'
                ? 'Employment Verified'
                : employmentVerificationStatus === 'started'
                  ? 'Employment Verification In Progress'
                  : 'Employment Verification Pending'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employmentVerificationStatus === 'approved'
                ? `Verified: ${employer_name}, ${salary} Monthly Salary`
                : 'Connect your Mexico bank account to verify your employment.'}
            </p>
          </div>
        </div>

        {employmentVerificationStatus !== 'approved' && (
          <div className="flex justify-end">
            <Button size="lg" onClick={() => connectBank('employment')} disabled={connectingPurpose !== null} className="gap-2">
              {connectingPurpose === 'employment' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5" />}
              {connectingPurpose === 'employment' ? 'Connecting...' : 'Connect Bank for Employment'}
              <ExternalLink className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Financial Statements Verification Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Financial Statements Verification</h3>
        </div>

        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${verification?.bank_statement_verification === 'approved'
          ? 'bg-accent/10 border-accent/20'
          : verification?.bank_statement_verification === 'started'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'}`}
        >
          {verification?.bank_statement_verification === 'approved' ? (
            <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${verification?.bank_statement_verification === 'started' ? 'text-amber-600' : 'text-slate-600'}`} />
          )}
          <div>
            <p className={`text-sm font-semibold ${verification?.bank_statement_verification === 'approved' ? 'text-accent' : verification?.bank_statement_verification === 'started' ? 'text-amber-700' : 'text-slate-700'}`}
            >
              {verification?.bank_statement_verification === 'approved'
                ? 'Financial Statements Verified'
                : verification?.bank_statement_verification === 'started'
                  ? 'Financial Statements Verification In Progress'
                  : 'Financial Statements Verification Pending'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verification?.bank_statement_verification === 'approved'
                ? 'Your financial statements have been verified through SAT (Tax Authority).'
                : 'Connect your SAT account to verify your financial statements and income.'}
            </p>

            {verification?.bank_statement_verification === 'approved' && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs border-t pt-3 border-accent/20">
                {verification.fiscal_year && (
                  <div>
                    <span className="text-muted-foreground block font-medium">Fiscal Year</span>
                    <span className="font-semibold text-foreground">{verification.fiscal_year}</span>
                  </div>
                )}
                {verification.financial_document_type && (
                  <div>
                    <span className="text-muted-foreground block font-medium">Document Type</span>
                    <span className="font-semibold text-foreground capitalize">
                      {verification.financial_document_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {verification.total_income !== undefined && verification.total_income !== null && (
                  <div>
                    <span className="text-muted-foreground block font-medium">Total Income</span>
                    <span className="font-semibold text-emerald-600 font-mono">
                      ${Number(verification.total_income).toLocaleString(undefined, { minimumFractionDigits: 2 })} {verification.financial_currency || 'MXN'}
                    </span>
                  </div>
                )}
                {verification.total_expenses !== undefined && verification.total_expenses !== null && (
                  <div>
                    <span className="text-muted-foreground block font-medium">Total Expenses</span>
                    <span className="font-semibold text-rose-600 font-mono">
                      ${Number(verification.total_expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })} {verification.financial_currency || 'MXN'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {verification?.bank_statement_verification !== 'approved' && (
          <div className="flex justify-end">
            <Button size="lg" onClick={() => connectBank('bank_statement')} disabled={connectingPurpose !== null} className="gap-2">
              {connectingPurpose === 'bank_statement' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5" />}
              {connectingPurpose === 'bank_statement' ? 'Connecting...' : 'Connect SAT for Financial Statements'}
              <ExternalLink className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        )}

        <Card className="mt-4">
          <CardContent className="p-4">
            <MultiUploadDocRow
              icon={FileText}
              label="Bank Details & Statements"
              description="Upload your bank statements or details (PDF, JPG, PNG)"
              documents={verification?.bank_documents || []}
              folder="bank-details"
              onUploaded={addBankDoc}
              onDeleted={deleteBankDoc}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )}

      <p className="text-xs text-muted-foreground">
        Documents are stored securely and only used for verification purposes. They are not shared publicly.
      </p>

      <Dialog open={showSatModal} onOpenChange={setShowSatModal}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSatSubmit}>
            <DialogHeader>
              <DialogTitle>Connect SAT for Financial Statements</DialogTitle>
              <DialogDescription>
                Please enter your credentials to verify your income and financial statements via the Tax Authority (SAT).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rfc">RFC (Tax ID)</Label>
                <Input
                  id="rfc"
                  placeholder="e.g. PFIS010101000"
                  value={rfcInput}
                  onChange={(e) => setRfcInput(e.target.value)}
                  maxLength={13}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ciec">CIEC Password</Label>
                <Input
                  id="ciec"
                  type="password"
                  placeholder="Password"
                  value={ciecInput}
                  onChange={(e) => setCiecInput(e.target.value)}
                  required
                />
              </div>
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <p className="font-semibold mb-1">Sandbox Testing Info:</p>
                <p>Individual: RFC <strong>PFIS010101000</strong> &amp; CIEC <strong>individual</strong></p>
                <p>Business: RFC <strong>PMO010101000</strong> &amp; CIEC <strong>business</strong></p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSatModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}