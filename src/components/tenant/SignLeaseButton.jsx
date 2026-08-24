import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, PenLine, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/owner/SignaturePad';
import { base44 } from '@/api/base44Client';
import { sendPushNotification } from '@/utils/pushNotification';

export default function SignLeaseButton({ booking, listing, onSigned, disabled = false }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [tenantFormData, setTenantFormData] = useState({
    nationality: '',
    passportNumber: '',
    tenantEmail2: '',
    bankAccountNumber: '',
    branch: '',
    bank: '',
    bankAddress1: '',
    bankAddress2: '',
    clabe: '',
    swiftCode: '',
    reference: '',
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUserProfile(u);
    }).catch(() => { });
  }, []);

  const handleSignClick = () => {
    if (disabled) return;
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

      // Prepare merged conditions to preserve landlord's entries and add tenant details
      const existingConditions = booking.agreement_conditions || {};
      const mergedConditions = {
        ...existingConditions,
        tenantSignature: signatureUrl,
        tenantSignatureDate: new Date().toISOString(),
        nationality: tenantFormData.nationality,
        passportNumber: tenantFormData.passportNumber,
        tenantEmail: userProfile?.email || '',
        tenantEmail2: tenantFormData.tenantEmail2,
        tenantPhone: userProfile?.phone_number || '',
        bankAccountNumber: tenantFormData.bankAccountNumber,
        branch: tenantFormData.branch,
        bank: tenantFormData.bank,
        bankAddress1: tenantFormData.bankAddress1,
        bankAddress2: tenantFormData.bankAddress2,
        clabe: tenantFormData.clabe,
        swiftCode: tenantFormData.swiftCode,
        reference: tenantFormData.reference,
      };

      // Update booking with tenant signature status and merged conditions
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'lease_pending',
          lease_status: 'pending_owner',
          agreement_conditions: mergedConditions,
          updated_date: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw new Error(error.message);

      // Call edge function to regenerate PDF with tenant signature URL and merged conditions
      /* OLD ANVIL LOGIC (Commented out)
      const res = await supabase.functions.invoke('anvil-send-lease', {
        body: {
          bookingId: booking.id,
          agreementConditions: mergedConditions,
          tenantSignature: signatureUrl,
          tenantSignatureDate: new Date().toISOString(),
          nationality: tenantFormData.nationality,
          passportNumber: tenantFormData.passportNumber,
          tenantEmail: userProfile?.email || '',
          tenantEmail2: tenantFormData.tenantEmail2,
          tenantPhone: userProfile?.phone_number || '',
          bankAccountNumber: tenantFormData.bankAccountNumber,
          branch: tenantFormData.branch,
          bank: tenantFormData.bank,
          bankAddress1: tenantFormData.bankAddress1,
          bankAddress2: tenantFormData.bankAddress2,
          clabe: tenantFormData.clabe,
          swiftCode: tenantFormData.swiftCode,
          reference: tenantFormData.reference,
        }
      });
      */

      const res = await supabase.functions.invoke('generate-lease-pdf', {
        body: {
          bookingId: booking.id,
          agreementConditions: mergedConditions,
          tenantSignature: signatureUrl,
          tenantSignatureDate: new Date().toISOString(),
          nationality: tenantFormData.nationality,
          passportNumber: tenantFormData.passportNumber,
          tenantEmail: userProfile?.email || '',
          tenantEmail2: tenantFormData.tenantEmail2,
          tenantPhone: userProfile?.phone_number || '',
          bankAccountNumber: tenantFormData.bankAccountNumber,
          branch: tenantFormData.branch,
          bank: tenantFormData.bank,
          bankAddress1: tenantFormData.bankAddress1,
          bankAddress2: tenantFormData.bankAddress2,
          clabe: tenantFormData.clabe,
          swiftCode: tenantFormData.swiftCode,
          reference: tenantFormData.reference,
        }
      });

      if (res.error) throw new Error(res.error.message || 'Failed to update lease');

      // Send push notification to owner
      try {
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('owner_id, listing_id')
          .eq('id', booking.id)
          .single();
        if (bookingData && bookingData.owner_id) {
          const { data: listingData } = await supabase
            .from('listings')
            .select('title')
            .eq('id', bookingData.listing_id)
            .single();
          const listingTitle = listingData?.title || 'Property';

          // Helper call for notification
          await sendPushNotification(
            bookingData.owner_id,
            'Lease signed by Tenant',
            `The tenant has signed the lease agreement for "${listingTitle}". It is now ready for your signature.`,
            '/owner-dashboard',
            'lease_signed_tenant'
          );
        }
      } catch (notiErr) {
        console.warn('Failed to send lease signature notification to owner', notiErr);
      }

      toast.success('Lease signed successfully! Awaiting owner signature.');
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
          disabled={isSigning || disabled}
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
                  {/* <li>Once signed, you'll be able to proceed with payment</li> */}
                </ul>
              </div>

              {/* Renter Personal & Bank Information Form */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                <h4 className="font-semibold text-sm text-slate-800 border-b pb-2">Renter Details & Identity Verification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Nationality *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.nationality}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, nationality: e.target.value })}
                      placeholder="e.g. Mexican / American"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Passport Number / ID *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.passportNumber}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, passportNumber: e.target.value })}
                      placeholder="Passport Number"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Account Email</label>
                    <input
                      type="text"
                      disabled
                      value={userProfile?.email || ''}
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Alternate Email *</label>
                    <input
                      type="email"
                      required
                      value={tenantFormData.tenantEmail2}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, tenantEmail2: e.target.value })}
                      placeholder="alternate@email.com"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Contact Number</label>
                    <input
                      type="text"
                      disabled
                      value={userProfile?.phone_number || ''}
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <h4 className="font-semibold text-sm text-slate-800 border-b pb-2 pt-2">Renter Bank Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Name *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.bank}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, bank: e.target.value })}
                      placeholder="e.g. BBVA"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Branch *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.branch}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, branch: e.target.value })}
                      placeholder="Branch name"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Address Line 1 *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.bankAddress1}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, bankAddress1: e.target.value })}
                      placeholder="Address Line 1"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Address Line 2</label>
                    <input
                      type="text"
                      value={tenantFormData.bankAddress2}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, bankAddress2: e.target.value })}
                      placeholder="Address Line 2"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Account Number *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.bankAccountNumber}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, bankAccountNumber: e.target.value })}
                      placeholder="Account Number"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">CLABE *</label>
                    <input
                      type="text"
                      required
                      value={tenantFormData.clabe}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, clabe: e.target.value })}
                      placeholder="18-digit CLABE"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Swift Code</label>
                    <input
                      type="text"
                      value={tenantFormData.swiftCode}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, swiftCode: e.target.value })}
                      placeholder="SWIFT/BIC Code"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Reference / Concept</label>
                    <input
                      type="text"
                      value={tenantFormData.reference}
                      onChange={(e) => setTenantFormData({ ...tenantFormData, reference: e.target.value })}
                      placeholder="Payment Reference"
                      className="w-full text-xs h-9 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!tenantFormData.nationality || !tenantFormData.passportNumber || !tenantFormData.tenantEmail2 || !tenantFormData.bank || !tenantFormData.branch || !tenantFormData.bankAddress1 || !tenantFormData.bankAccountNumber || !tenantFormData.clabe) {
                    toast.error("Please fill in all mandatory fields before signing.");
                    return;
                  }
                  setShowSignaturePad(true);
                }}
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