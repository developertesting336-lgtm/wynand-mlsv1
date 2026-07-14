import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, PenLine, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/owner/SignaturePad';
import { base44 } from '@/api/base44Client';

export default function SignLeaseButton({ booking, listing, onSigned }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUserProfile).catch(() => {});
  }, []);

  const handleSignClick = () => {
    setIsOpen(true);
    setShowSignaturePad(false);
  };

  const handleSignatureSave = async (signature) => {
    setIsSigning(true);
    try {
      let signatureUrl = signature;
      if (!signature.startsWith('http')) {
        // Convert base64 data URL to a File object
        const arr = signature.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], `signs/signature_tenant_${booking.id}.png`, { type: mime });
        
        // Upload file to Supabase storage bucket via base44 SDK
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = uploadResult?.file_url;
        
        if (!signatureUrl) {
          throw new Error('Failed to obtain signature public URL from storage.');
        }

        // Save new signature to profile array
        if (userProfile) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('signatures')
              .eq('id', userProfile.id)
              .single();
            const currentSigs = profile?.signatures || [];
            if (!currentSigs.includes(signatureUrl)) {
              const updatedSigs = [...currentSigs, signatureUrl].slice(-3);
              await supabase
                .from('profiles')
                .update({ signatures: updatedSigs })
                .eq('id', userProfile.id);
              setUserProfile(prev => ({ ...prev, signatures: updatedSigs }));
            }
          } catch (profileErr) {
            console.error('Failed to append signature to profile:', profileErr);
          }
        }
      }

      // Prepare merged conditions to preserve landlord's entries
      const existingConditions = booking.agreement_conditions || {};
      const mergedConditions = {
        ...existingConditions,
        tenantSignature: signatureUrl,
        tenantSignatureDate: new Date().toISOString()
      };

      // Update booking with tenant signature status and merged conditions
      const { error } = await supabase
        .from('bookings')
        .update({
          lease_status: 'approved',
          agreement_conditions: mergedConditions,
          updated_date: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw new Error(error.message);

      // Call edge function to regenerate PDF with tenant signature URL and merged conditions
      const res = await supabase.functions.invoke('anvil-send-lease', {
        body: {
          bookingId: booking.id,
          agreementConditions: mergedConditions,
          tenantSignature: signatureUrl,
          tenantSignatureDate: new Date().toISOString()
        }
      });

      if (res.error) throw new Error(res.error.message || 'Failed to update lease');

      toast.success('Lease signed successfully! You can now proceed with payment.');
      setIsOpen(false);
      setShowSignaturePad(false);
      // Invalidate queries to refresh the bookings list
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
      if (onSigned) onSigned();
    } catch (err) {
      console.error('Error signing lease:', err);
      toast.error(`Failed to sign lease: ${err.message}`);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          onClick={handleSignClick}
          disabled={isSigning}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-[0.98] py-1 px-2.5 h-auto whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <PenLine className="w-3.5 h-3.5 mr-1.5" />
          Sign Lease
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sign Lease Agreement</DialogTitle>
          </DialogHeader>

          {!showSignaturePad ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2">Lease Agreement</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Property: <span className="font-medium text-foreground">{listing?.title || 'Property'}</span>
                </p>
                {booking.lease_pdf_url ? (
                  <a
                    href={booking.lease_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4" /> View Lease Agreement
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Lease agreement not yet available</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">Before you sign:</h4>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Review the lease agreement carefully</li>
                  <li>Ensure all details are correct</li>
                  <li>Once signed, you'll be able to proceed with payment</li>
                </ul>
              </div>

              <Button
                onClick={() => setShowSignaturePad(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!booking.lease_pdf_url}
              >
                <PenLine className="w-4 h-4 mr-2" />
                I've reviewed the lease - Sign Now
              </Button>
            </div>
          ) : (
            <SignaturePad
              title="Tenant Signature"
              savedSignatures={userProfile?.signatures || []}
              onSave={handleSignatureSave}
              onCancel={() => {
                setShowSignaturePad(false);
              }}
              isSubmitting={isSigning}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}