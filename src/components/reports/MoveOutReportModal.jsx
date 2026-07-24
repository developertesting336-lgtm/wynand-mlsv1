import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { generateBeautifulMoveOutPDF } from '@/utils/moveOutPdfGenerator';
import { sendPushNotification } from '@/utils/pushNotification';
import { format } from 'date-fns';

function formatSignatureDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
}

function normalizeNumber(value) {
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function MoveOutReportModal({
  booking,
  listing,
  userRole,
  userProfile,
  open,
  onClose,
  onSaved,
  onSigned,
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    moveOutSummary: '',
    inspectionFindings: '',
    damageReport: '',
    damageDeduction: 0,
    finalInvoice: '',
    closeLease: false,
  });
  const [selectedSignature, setSelectedSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);

  const report = booking?.move_out_report || {};
  const isOwner = userRole === 'owner';
  const isTenant = userRole === 'tenant';
  const isAgent = userRole === 'agent';
  const ownerSigned = Boolean(report.ownerSignature);
  const tenantSigned = Boolean(report.tenantSignature);
  const agentSigned = Boolean(report.agentSignature);
  const allSigned = ownerSigned && tenantSigned && agentSigned;
  const canEdit = isOwner && !allSigned;

  useEffect(() => {
    if (!booking) return;
    const reportData = booking.move_out_report || {};
    setDraft({
      moveOutSummary: reportData.moveOutSummary || '',
      inspectionFindings: reportData.inspectionFindings || '',
      damageReport: reportData.damageReport || '',
      damageDeduction: reportData.damageDeduction ?? 0,
      finalInvoice: reportData.finalInvoice || '',
      refundAmount: reportData.refundAmount ?? 0,
      closeLease: reportData.closeLease || false,
      pdfUrl: reportData.pdfUrl || null,
      ownerSignature: reportData.ownerSignature || null,
      ownerSignatureDate: reportData.ownerSignatureDate || null,
      tenantSignature: reportData.tenantSignature || null,
      tenantSignatureDate: reportData.tenantSignatureDate || null,
      agentSignature: reportData.agentSignature || null,
      agentSignatureDate: reportData.agentSignatureDate || null,
    });
    setSelectedSignature(userProfile?.signatures?.[0] || '');
  }, [booking?.id, open, userProfile?.signatures]);

  const depositAmount = useMemo(() => {
    const raw = booking?.agreement_conditions?.securityDepositAmount ?? booking?.agreement_conditions?.depositAmount ?? 0;
    return normalizeNumber(raw);
  }, [booking]);

  const damageDeduction = normalizeNumber(draft.damageDeduction);
  const refundAmount = Math.max(0, depositAmount - damageDeduction);

  const signatureRole = isOwner ? 'owner' : isTenant ? 'tenant' : isAgent ? 'agent' : null;
  const signatureField = signatureRole ? `${signatureRole}Signature` : null;
  const signatureDateField = signatureRole ? `${signatureRole}SignatureDate` : null;

  useEffect(() => {
    if (!selectedSignature && userProfile?.signatures?.length) {
      setSelectedSignature(userProfile.signatures[0]);
    }
  }, [userProfile?.signatures, selectedSignature]);

  const handleReportSave = async () => {
    setSaving(true);
    try {
      const existingReport = booking.move_out_report || {};
      const updatedReport = {
        ...existingReport,
        moveOutSummary: draft.moveOutSummary,
        inspectionFindings: draft.inspectionFindings,
        damageReport: draft.damageReport,
        damageDeduction,
        finalInvoice: draft.finalInvoice,
        refundAmount,
        depositAmount,
        closeLease: draft.closeLease,
        updatedAt: new Date().toISOString(),
      };

      let pdfUrl = existingReport.pdfUrl || null;
      try {
        const doc = await generateBeautifulMoveOutPDF(booking, updatedReport, listing?.title || 'Property', true);
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `move_out_report_${booking.id}.pdf`, { type: 'application/pdf' });
        const res = await base44.integrations.Core.UploadFile({ file });
        if (res?.file_url) pdfUrl = res.file_url;
      } catch (err) {
        console.warn('Move-out PDF generation failed:', err);
      }

      if (pdfUrl) {
        updatedReport.pdfUrl = pdfUrl;
      }

      const { error } = await supabase
        .from('bookings')
        .update({ move_out_report: updatedReport })
        .eq('id', booking.id);
      if (error) throw error;

      toast.success('Move-out report saved successfully!');
      onSaved?.(updatedReport);
      setDraft(prev => ({ ...prev, ...updatedReport, refundAmount }));

      const targets = [booking.renter_id, booking.agent_id].filter(Boolean);
      await Promise.allSettled(
        targets.map(async (targetUserId) => {
          const url = targetUserId === booking.renter_id ? '/dashboard' : '/agent-dashboard';
          await sendPushNotification(
            targetUserId,
            'Move-out report ready to sign',
            `${listing?.title || 'Your property'} move-out report has been generated. Please sign it.`,
            url,
            'move_out_report'
          );
        })
      );

      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-bookings'] });
      onClose();
    } catch (err) {
      console.error('Failed to save move-out report:', err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!signatureRole) return;
    if (!selectedSignature) {
      toast.error('Please select a signature before signing.');
      return;
    }

    setSigning(true);
    try {
      const existingReport = booking.move_out_report || {};
      const updatedReport = {
        ...existingReport,
        ...draft,
        damageDeduction,
        refundAmount,
        depositAmount,
        [signatureField]: selectedSignature,
        [signatureDateField]: new Date().toISOString(),
      };

      let pdfUrl = existingReport.pdfUrl || null;
      try {
        const doc = await generateBeautifulMoveOutPDF(booking, updatedReport, listing?.title || 'Property', true);
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `move_out_report_${booking.id}.pdf`, { type: 'application/pdf' });
        const res = await base44.integrations.Core.UploadFile({ file });
        if (res?.file_url) pdfUrl = res.file_url;
      } catch (err) {
        console.warn('Move-out PDF generation failed during signing:', err);
      }
      if (pdfUrl) updatedReport.pdfUrl = pdfUrl;

      const { error } = await supabase
        .from('bookings')
        .update({ move_out_report: updatedReport })
        .eq('id', booking.id);
      if (error) throw error;

      toast.success('Report signed successfully!');
      onSaved?.(updatedReport);
      setDraft(prev => ({ ...prev, ...updatedReport, refundAmount }));
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-bookings'] });
      onSigned?.();
    } catch (err) {
      console.error('Signing failed:', err);
      toast.error(`Sign failed: ${err.message}`);
    } finally {
      setSigning(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-[700px] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Move-out Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4 text-sm">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p><strong>Property:</strong> {listing?.title || 'Property'}</p>
            <p><strong>Move-out Date:</strong> {booking.move_out_date || 'N/A'}</p>
            {allSigned && isOwner ? (
              <p className="text-xs text-emerald-700 mt-2">All parties have signed. Editing is locked.</p>
            ) : null}
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">1. Move-out Summary</h4>
            {canEdit ? (
              <textarea
                className="w-full min-h-[110px] border rounded-2xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={draft.moveOutSummary}
                onChange={(e) => setDraft({ ...draft, moveOutSummary: e.target.value })}
                placeholder="Describe the tenant move-out condition, handover notes, and observations..."
              />
            ) : (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
                {report.moveOutSummary || 'No move-out summary submitted yet.'}
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">2. Inspection Findings</h4>
            {canEdit ? (
              <textarea
                className="w-full min-h-[110px] border rounded-2xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={draft.inspectionFindings}
                onChange={(e) => setDraft({ ...draft, inspectionFindings: e.target.value })}
                placeholder="Document the move-out inspection findings, damage, condition notes and required repairs..."
              />
            ) : (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
                {report.inspectionFindings || 'No inspection findings submitted yet.'}
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">3. Damage Report</h4>
            {canEdit ? (
              <textarea
                className="w-full min-h-[110px] border rounded-2xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={draft.damageReport}
                onChange={(e) => setDraft({ ...draft, damageReport: e.target.value })}
                placeholder="List any damages beyond normal wear and tear, estimated repair costs, and responsible party notes..."
              />
            ) : (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
                {report.damageReport || 'No damage report submitted yet.'}
              </p>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-800">4. Security Deposit</h4>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[.15em]">Security Deposit</label>
                <input
                  type="number"
                  readOnly
                  value={depositAmount}
                  className="w-full border rounded-2xl p-3 text-sm bg-slate-100 text-slate-700 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500">Pulled from booking agreement conditions.</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-800">5. Damage Amount</h4>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                {canEdit ? (
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded-2xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={draft.damageDeduction}
                    onChange={(e) => setDraft({ ...draft, damageDeduction: normalizeNumber(e.target.value) })}
                    placeholder="Damage amount"
                  />
                ) : (
                  <p>{report.damageDeduction ? `$${normalizeNumber(report.damageDeduction).toLocaleString()}` : '$0'}</p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-800">6. Refund Amount</h4>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="text-slate-700"><strong>Refund Due:</strong> ${refundAmount.toLocaleString()}</p>
              <p className="text-slate-500">Calculated as security deposit minus damage amount.</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">6. Final Invoice</h4>
            {canEdit ? (
              <textarea
                className="w-full min-h-[110px] border rounded-2xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={draft.finalInvoice}
                onChange={(e) => setDraft({ ...draft, finalInvoice: e.target.value })}
                placeholder="Summarize final charges, outstanding balances, deposit refunds, and invoice details..."
              />
            ) : (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
                {report.finalInvoice || 'No final invoice details submitted yet.'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                id="close-lease-checkbox"
                type="checkbox"
                checked={draft.closeLease}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, closeLease: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/50"
              />
              <label htmlFor="close-lease-checkbox" className="text-sm">Mark lease as completed / terminated</label>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">Signatures</h4>
            <div className="grid grid-cols-3 gap-4">
              {['owner', 'tenant', 'agent'].map((role) => {
                const signature = report[`${role}Signature`];
                const signatureDate = report[`${role}SignatureDate`];
                const title = role === 'owner' ? 'Owner Signature' : role === 'tenant' ? 'Tenant Signature' : 'Agent Signature';
                const isCurrentUser = signatureRole === role;

                return (
                  <div key={role} className="p-3 border rounded-xl bg-slate-50/80">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">{title}</p>
                    {signature ? (
                      <div className="space-y-2">
                        <img
                          src={signature}
                          alt={`${title.toLowerCase()}`}
                          className="h-12 object-contain bg-white rounded border border-slate-200 p-1"
                        />
                        <span className="text-[10px] text-emerald-600 font-semibold block">Signed</span>
                        <p className="text-[10px] text-slate-500">{formatSignatureDate(signatureDate)}</p>
                      </div>
                    ) : isCurrentUser ? (
                      <div className="space-y-2">
                        {userProfile?.signatures?.length > 0 ? (
                          <>
                            <select
                              className="w-full p-2 rounded border border-slate-200 text-xs bg-white focus:outline-none"
                              value={selectedSignature}
                              onChange={(e) => setSelectedSignature(e.target.value)}
                            >
                              <option value="">Select saved signature...</option>
                              {(userProfile?.signatures || []).map((sig, idx) => (
                                <option key={idx} value={sig}>Saved Signature {idx + 1}</option>
                              ))}
                            </select>
                            {selectedSignature ? (
                              <div className="border p-2 bg-white rounded flex justify-center">
                                <img src={selectedSignature} alt="selected signature preview" className="h-12 object-contain" />
                              </div>
                            ) : null}
                            <Button
                              size="sm"
                              className="w-full text-xs font-semibold py-2"
                              disabled={!selectedSignature || signing}
                              onClick={handleSign}
                            >
                              {signing ? 'Signing...' : 'Sign Now'}
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No saved signatures available</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {role === 'owner' ? 'Pending owner signature...' : role === 'tenant' ? 'Pending tenant signature...' : 'Pending agent signature...'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button onClick={handleReportSave} disabled={saving || !booking.move_out_date}>
              {saving ? 'Saving...' : 'Save Report'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
