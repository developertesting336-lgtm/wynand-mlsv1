import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFavorites } from '@/hooks/useFavorites';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Heart, MessageSquare, Calendar, Search, User,
  MapPin, ExternalLink, Clock, CheckCircle, XCircle, Hourglass, Star, ShieldCheck,
  CreditCard, Loader2, Reply, FileText, PenLine, Download
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import ListingCard from '@/components/listings/ListingCard';
import ReviewForm from '@/components/reviews/ReviewForm';
import TenantVerification from '@/components/profile/TenantVerification';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import SignLeaseButton from '@/components/tenant/SignLeaseButton';
import MoveOutReportModal from '@/components/reports/MoveOutReportModal';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import ReferralPaymentsTab from '@/components/ReferralPaymentsTab';
import InquiryReplies from '@/components/inquiries/InquiryReplies';
import InquiryKanban from '@/components/inquiries/InquiryKanban';
import PaidBookingChat from '@/components/chat/PaidBookingChat';
import { toast } from 'sonner';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import { sendPushNotification } from '@/utils/pushNotification';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Inquiry row removed: InquiryKanban now handles chat layout ────────────────

// ── Reusable Maintenance View Panel (used in all dashboards) ─────────────────
function MaintenanceViewPanel({ booking, onClose, isTenant = false, tenantName = 'Tenant', listingTitle = 'your property' }) {
  const [mrSearch, setMrSearch] = useState('');
  const [mrPage, setMrPage] = useState(1);
  const mrPageSize = 5;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const allRequests = [...(booking.maintenance_requests || [])].reverse();
  const filtered = allRequests.filter(r =>
    (r.subject || '').toLowerCase().includes(mrSearch.toLowerCase()) ||
    (r.details || '').toLowerCase().includes(mrSearch.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / mrPageSize));
  const paginated = filtered.slice((mrPage - 1) * mrPageSize, mrPage * mrPageSize);

  const handleCreate = async () => {
    if (!subject.trim() || !details.trim()) return;
    setSaving(true);
    try {
      const existing = booking.maintenance_requests || [];
      const updated = [...existing, { subject: subject.trim(), details: details.trim(), created_at: new Date().toISOString() }];
      const { error } = await supabase.from('bookings').update({ maintenance_requests: updated }).eq('id', booking.id);
      if (error) throw error;

      if (booking.owner_id) {
        await sendPushNotification(
          booking.owner_id,
          'New maintenance request',
          `${tenantName} has submitted a maintenance request for ${listingTitle}.`,
          '/owner-dashboard',
          'maintenance'
        );
      }

      booking.maintenance_requests = updated;
      toast.success('Maintenance request submitted!');
      setSubject('');
      setDetails('');
      setShowCreateForm(false);
      setMrPage(1);
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 h-[32rem] flex flex-col">
      {/* Search + New Request */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search by subject or details..."
            value={mrSearch}
            onChange={e => { setMrSearch(e.target.value); setMrPage(1); }}
          />
        </div>
        {isTenant && (
          <Button size="sm" onClick={() => setShowCreateForm(v => !v)} className="text-xs whitespace-nowrap">
            {showCreateForm ? 'Cancel' : '+ New Request'}
          </Button>
        )}
      </div>

      {/* Inline Create Form (tenant only) */}
      {isTenant && showCreateForm && (
        <div className="border rounded-xl p-3 bg-blue-50 space-y-2">
          <p className="text-xs font-semibold text-slate-700">New Maintenance Request</p>
          <input
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <textarea
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            placeholder="Describe the issue..."
            rows={3}
            value={details}
            onChange={e => setDetails(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!subject.trim() || !details.trim() || saving} onClick={handleCreate} className="text-xs">
              {saving ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {mrSearch ? 'No requests match your search.' : 'No maintenance requests yet.'}
          </p>
        ) : (
          paginated.map((req, idx) => (
            <div key={idx} className="border rounded-xl p-3 bg-slate-50 space-y-1">
              <p className="font-semibold text-sm">{req.subject}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{req.details}</p>
              <p className="text-[10px] text-slate-400">{req.created_at ? new Date(req.created_at).toLocaleString() : ''}</p>
            </div>
          ))
        )}
      </div>

      {/* Pagination + Close */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {totalPages > 1 && (
            <>
              <Button size="sm" variant="outline" disabled={mrPage === 1} onClick={() => setMrPage(mrPage - 1)}>Prev</Button>
              <span>Page {mrPage} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={mrPage === totalPages} onClick={() => setMrPage(mrPage + 1)}>Next</Button>
            </>
          )}
          {filtered.length > 0 && <span className="text-xs text-slate-400">({filtered.length} total)</span>}
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}


function BookingsTab({ bookings = [], isLoading, listings = [], userEmail, userProfile }) {
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const [payingId, setPayingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  // States for move out date modal dialog
  const [selectedBookingForMoveOut, setSelectedBookingForMoveOut] = useState(null);
  const [modalMoveOutDate, setModalMoveOutDate] = useState('');

  // States for inspection modal
  const [inspectionBooking, setInspectionBooking] = useState(null);
  const [inspectionSelectedSignature, setInspectionSelectedSignature] = useState('');
  const [inspectionSigning, setInspectionSigning] = useState(false);
  const [moveOutBooking, setMoveOutBooking] = useState(null);

  // States for maintenance requests modal
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [selectedBookingForMaintenance, setSelectedBookingForMaintenance] = useState(null);
  const [maintenanceSubject, setMaintenanceSubject] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [viewMaintenanceModalOpen, setViewMaintenanceModalOpen] = useState(false);
  const [viewMaintenanceBooking, setViewMaintenanceBooking] = useState(null);

  const openMaintenanceModal = (booking) => {
    setSelectedBookingForMaintenance(booking);
    setMaintenanceSubject('');
    setMaintenanceDetails('');
    setMaintenanceModalOpen(true);
  };

  const openViewMaintenanceModal = (booking) => {
    setViewMaintenanceBooking(booking);
    setViewMaintenanceModalOpen(true);
  };

  // Pre-select first saved signature when opening the inspection modal
  useEffect(() => {
    if (inspectionBooking && userProfile?.signatures?.length) {
      setInspectionSelectedSignature(prev => prev || userProfile.signatures[0]);
    }
  }, [inspectionBooking, userProfile?.signatures]);

  const filteredBookings = bookings.filter(b => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[b.listing_id];
    return [
      listing?.title,
      b.listing_title,
      b.owner_email,
      b.agent_email,
      b.status,
      b.lease_status,
      b.move_in_date,
    ]
      .filter(Boolean)
      .some(value => value.toString().toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handlePayment = async (bookingId) => {
    setPayingId(bookingId);
    try {
      const res = await supabase.functions.invoke('stripe-checkout', {
        body: JSON.stringify({
          bookingId,
          origin: window.location.origin
        })
      });

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try {
          data = await res.json();
        } catch (err) {
          console.warn('Response is not JSON, using raw object:', err);
        }
      }

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
        setPayingId(null);
      } else {
        toast.error('Failed to start payment checkout.');
        setPayingId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error starting payment checkout.');
      setPayingId(null);
    }
  };

  const handleSaveMoveOutDate = async () => {
    if (!selectedBookingForMoveOut) return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ move_out_date: modalMoveOutDate || null })
        .eq('id', selectedBookingForMoveOut.id);
      if (error) throw error;
      toast.success('Move-out date saved successfully');
      setSelectedBookingForMoveOut(null);
      window.location.reload();
    } catch (err) {
      console.error('Failed to update move-out date:', err);
      toast.error('Failed to update move-out date');
    }
  };

  return (
    <>
      <BookingsTable
        bookings={bookings}
        listingMap={listingMap}
        search={search}
        setSearch={setSearch}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        filteredBookings={filteredBookings}
        paginatedBookings={paginatedBookings}
        payingId={payingId}
        handlePayment={handlePayment}
        setSelectedBookingForMoveOut={setSelectedBookingForMoveOut}
        setModalMoveOutDate={setModalMoveOutDate}
        setMoveOutBooking={setMoveOutBooking}
        totalPages={totalPages}
        setInspectionBooking={setInspectionBooking}
        setInspectionSelectedSignature={setInspectionSelectedSignature}
        userProfile={userProfile}
        openMaintenanceModal={openMaintenanceModal}
        openViewMaintenanceModal={openViewMaintenanceModal}
      />
      <MoveOutReportModal
        booking={moveOutBooking}
        listing={moveOutBooking ? listingMap[moveOutBooking.listing_id] : null}
        userRole="tenant"
        userProfile={userProfile}
        open={!!moveOutBooking}
        onClose={() => setMoveOutBooking(null)}
        onSaved={(updatedReport) => {
          if (!moveOutBooking) return;
          setMoveOutBooking((current) => current ? { ...current, move_out_report: updatedReport } : current);
        }}
      />
      <Dialog open={!!selectedBookingForMoveOut} onOpenChange={(open) => !open && setSelectedBookingForMoveOut(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Set Move-out Date
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">
              Please specify the date you plan to move out of the property.
            </p>
            <div className="space-y-2">
              <label htmlFor="move-out-date-input" className="text-xs font-semibold text-slate-700 font-medium">Move-out Date</label>
              <Input
                id="move-out-date-input"
                type="date"
                value={modalMoveOutDate}
                onChange={(e) => setModalMoveOutDate(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedBookingForMoveOut(null)}
              className="rounded-2xl h-11 px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMoveOutDate}
              className="rounded-2xl h-11 px-5"
            >
              Save Date
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inspection Modal Dialog for Tenant */}
      {inspectionBooking && (
        <Dialog open={!!inspectionBooking} onOpenChange={() => setInspectionBooking(null)}>
          <DialogContent className="sm:max-w-[650px] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Move-in Inspection Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm space-y-2">
                <p><strong>Property:</strong> {listingMap[inspectionBooking.listing_id]?.title || 'Property'}</p>
                <p><strong>Move-in Date:</strong> {inspectionBooking.move_in_date}</p>
              </div>

              {/* Inventory */}
              <div>
                <h4 className="text-sm font-bold text-slate-800">1. Property Inventory & Condition</h4>
                <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
                  {inspectionBooking.inspection_report?.inventory || 'No inventory details submitted.'}
                </p>
              </div>

              {/* Photos */}
              {inspectionBooking.inspection_report?.photos?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2">2. Inspection Photos</h4>
                  <div className="flex flex-wrap gap-2">
                    {inspectionBooking.inspection_report.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer noopener" className="block w-20 h-20 rounded-xl overflow-hidden border">
                        <img src={url} alt="inspection" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Meter Readings */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">3. Meter Readings</h4>
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl">
                  <p><strong>Electricity:</strong> {inspectionBooking.inspection_report?.meterReadings?.electricity || '—'} kWh</p>
                  <p><strong>Water:</strong> {inspectionBooking.inspection_report?.meterReadings?.water || '—'} m³</p>
                  <p><strong>Gas:</strong> {inspectionBooking.inspection_report?.meterReadings?.gas || '—'}</p>
                  <p><strong>Other:</strong> {inspectionBooking.inspection_report?.meterReadings?.other || '—'}</p>
                </div>
              </div>

              {/* Keys Issued */}
              <div>
                <h4 className="text-sm font-bold text-slate-800">4. Keys/Cards Handed Over</h4>
                <p className="text-xs text-slate-600 mt-1">
                  {inspectionBooking.inspection_report?.keysIssued || 'None recorded.'}
                </p>
              </div>

              {/* Deposit Recorded */}
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">
                  {inspectionBooking.inspection_report?.depositRecorded ? 'Security Deposit fully paid & confirmed by Owner' : 'Deposit confirmation pending'}
                </span>
              </div>

              {/* Signatures status */}
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-bold text-slate-800">Signatures Status</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {/* Owner */}
                  <div className="p-2 border rounded-xl bg-slate-50">
                    <p className="font-bold text-slate-500 mb-1">Owner</p>
                    {inspectionBooking.inspection_report?.ownerSignature ? (
                      <img src={inspectionBooking.inspection_report.ownerSignature} alt="owner signature" className="h-8 mx-auto object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Pending</span>
                    )}
                  </div>
                  {/* Tenant */}
                  <div className="p-2 border rounded-xl bg-slate-50">
                    <p className="font-bold text-slate-500 mb-1">Tenant (You)</p>
                    {inspectionBooking.inspection_report?.tenantSignature ? (
                      <img src={inspectionBooking.inspection_report.tenantSignature} alt="tenant signature" className="h-8 mx-auto object-contain" />
                    ) : (
                      <div className="space-y-2">
                        <select
                          className="w-full p-1 rounded border text-[10px] bg-white focus:outline-none"
                          value={inspectionSelectedSignature}
                          onChange={(e) => setInspectionSelectedSignature(e.target.value)}
                        >
                          <option value="">Select saved signature...</option>
                          {(userProfile?.signatures || []).map((sig, idx) => (
                            <option key={idx} value={sig}>Saved Signature {idx + 1}</option>
                          ))}
                        </select>
                        {inspectionSelectedSignature && (
                          <div className="border p-1 bg-white rounded flex justify-center">
                            <img src={inspectionSelectedSignature} alt="selected signature preview" className="h-8 object-contain" />
                          </div>
                        )}
                        <Button
                          size="xs"
                          className="w-full text-[10px] h-6"
                          disabled={!inspectionSelectedSignature || inspectionSigning}
                          onClick={async () => {
                            setInspectionSigning(true);
                            try {
                              const existingReport = inspectionBooking.inspection_report || {};
                              const updatedReport = {
                                ...existingReport,
                                tenantSignature: inspectionSelectedSignature,
                                tenantSignatureDate: new Date().toISOString(),
                              };

                              // Generate beautiful PDF and upload to Supabase storage
                              try {
                                const { generateBeautifulInspectionPDF } = await import('../utils/inspectionPdfGenerator');
                                const doc = await generateBeautifulInspectionPDF(
                                  inspectionBooking,
                                  updatedReport,
                                  'Property',
                                  true
                                );
                                const pdfBlob = doc.output('blob');
                                const file = new File([pdfBlob], `inspection_report_${inspectionBooking.id}.pdf`, { type: 'application/pdf' });
                                const res = await base44.integrations.Core.UploadFile({ file });
                                if (res?.file_url) {
                                  updatedReport.pdfUrl = res.file_url;
                                }
                              } catch (pdfErr) {
                                console.warn('PDF regeneration/upload failed during Tenant signature:', pdfErr);
                              }

                              const { error } = await supabase
                                .from('bookings')
                                .update({ inspection_report: updatedReport })
                                .eq('id', inspectionBooking.id);
                              if (error) throw error;
                              toast.success('Inspection report signed by Tenant');
                              inspectionBooking.inspection_report = updatedReport;
                              setInspectionBooking({ ...inspectionBooking });
                            } catch (err) {
                              toast.error(`Sign failed: ${err.message}`);
                            } finally {
                              setInspectionSigning(false);
                            }
                          }}
                        >
                          Sign
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* Agent */}
                  <div className="p-2 border rounded-xl bg-slate-50">
                    <p className="font-bold text-slate-500 mb-1">Agent</p>
                    {inspectionBooking.inspection_report?.agentSignature ? (
                      <img src={inspectionBooking.inspection_report.agentSignature} alt="agent signature" className="h-8 mx-auto object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center border-t pt-4">
              <Button variant="outline" onClick={() => setInspectionBooking(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Maintenance Request Modal */}
      {maintenanceModalOpen && (
        <Dialog open={maintenanceModalOpen} onOpenChange={(open) => { if (!open) setMaintenanceModalOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Maintenance Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium block mb-1">Subject</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Leaking faucet in bathroom"
                  value={maintenanceSubject}
                  onChange={(e) => setMaintenanceSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Details</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Describe the issue in detail..."
                  rows={4}
                  value={maintenanceDetails}
                  onChange={(e) => setMaintenanceDetails(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setMaintenanceModalOpen(false)}>Cancel</Button>
              <Button
                disabled={!maintenanceSubject.trim() || !maintenanceDetails.trim() || maintenanceSaving}
                onClick={async () => {
                  setMaintenanceSaving(true);
                  try {
                    const existing = selectedBookingForMaintenance.maintenance_requests || [];
                    const newRequest = {
                      subject: maintenanceSubject.trim(),
                      details: maintenanceDetails.trim(),
                      created_at: new Date().toISOString(),
                    };
                    const updated = [...existing, newRequest];
                    const { error } = await supabase
                      .from('bookings')
                      .update({ maintenance_requests: updated })
                      .eq('id', selectedBookingForMaintenance.id);
                    if (error) throw error;

                    if (selectedBookingForMaintenance.owner_id) {
                      const propertyTitle = listingMap[selectedBookingForMaintenance.listing_id]?.title || selectedBookingForMaintenance.listing_title || 'your property';
                      await sendPushNotification(
                        selectedBookingForMaintenance.owner_id,
                        'New maintenance request',
                        `${userProfile?.full_name || 'Tenant'} has submitted a maintenance request for ${propertyTitle}.`,
                        '/owner-dashboard',
                        'maintenance'
                      );
                    }

                    toast.success('Maintenance request submitted!');
                    setMaintenanceModalOpen(false);
                  } catch (err) {
                    toast.error(`Failed: ${err.message}`);
                  } finally {
                    setMaintenanceSaving(false);
                  }
                }}
              >
                {maintenanceSaving ? 'Saving...' : 'Submit Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View All Maintenance Requests Modal */}
      {viewMaintenanceModalOpen && viewMaintenanceBooking && (
        <Dialog open={viewMaintenanceModalOpen} onOpenChange={(open) => { if (!open) setViewMaintenanceModalOpen(false); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🔧 Maintenance Requests
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  — {viewMaintenanceBooking.listing_title || 'Property'}
                </span>
              </DialogTitle>
            </DialogHeader>
            <MaintenanceViewPanel
              booking={viewMaintenanceBooking}
              onClose={() => setViewMaintenanceModalOpen(false)}
              isTenant={true}
              tenantName={userProfile?.full_name || 'Tenant'}
              listingTitle={listingMap[viewMaintenanceBooking.listing_id]?.title || viewMaintenanceBooking.listing_title || 'your property'}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function BookingsTable({ bookings, listingMap, search, setSearch, page, setPage, pageSize, setPageSize, filteredBookings, paginatedBookings, payingId, handlePayment, setSelectedBookingForMoveOut, setModalMoveOutDate, setMoveOutBooking, totalPages, setInspectionBooking, setInspectionSelectedSignature, userProfile, openMaintenanceModal, openViewMaintenanceModal }) {
  const statusConfig = {
    pending: { label: 'Pending Approval', icon: Hourglass, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    lease_pending: { label: 'Sign Lease Agreement', icon: PenLine, cls: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' },
    approved: { label: 'Approved (Pay Now)', icon: CheckCircle, cls: 'bg-green-100 text-green-700 border-green-200 animate-pulse' },
    confirmed: { label: 'Confirmed & Paid', icon: CheckCircle, cls: 'bg-blue-100 text-blue-700 border-blue-200 font-semibold' },
    declined: { label: 'Declined', icon: XCircle, cls: 'bg-red-100 text-red-700 border-red-200' },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search bookings by property, owner, or status"
            className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="bookings-page-size" className="font-medium">Show</label>
          <select
            id="bookings-page-size"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {[10, 15, 25].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-lg">No bookings match your search</p>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting the search query.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Move-out Date</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Lease Agreement</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Agent Signed</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Inspection Report</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Move-out Report</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Maintenance</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedBookings.map(b => {
              const listing = listingMap[b.listing_id];
              const ownerEmail = b.owner_email || listing?.owner_email || '—';
              const ownerName = listing?.owner_name || 'Owner';
              const { label, icon: Icon, cls } = statusConfig[b.status] || statusConfig.pending;
              
              // Use agreement_conditions for payment amounts
              const conditions = b.agreement_conditions || {};
              const depositAmount = parseFloat(conditions.securityDepositAmount) || 0;
              const rentAmount = parseFloat(conditions.monthlyRent?.toString().replace(/[^0-9.]/g, '')) || 0;
              const totalAmount = depositAmount + (rentAmount * 2);
              const agentSigned = Boolean(conditions.agentSignature);

              return (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/listings/${b.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold">
                      {listing?.title || b.listing_title || 'Property'} <ExternalLink className="w-3 h-3 opacity-60" />
                    </Link>
                    {b.message && (
                      <p className="text-xs text-muted-foreground italic mt-1 max-w-[200px] truncate" title={b.message}>
                        "{b.message}"
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.move_in_date ? format(new Date(b.move_in_date + 'T00:00:00'), 'MMMM d, yyyy') : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    {b.end_lease ? (
                      <span className="text-muted-foreground text-sm font-medium">
                        {b.move_out_date ? format(new Date(b.move_out_date + 'T00:00:00'), 'MMMM d, yyyy') : '—'}
                      </span>
                    ) : (() => {
                      // Check if the remaining time until move-out is less than 30 days from now
                      let isWithin30Days = false;
                      if (b.move_out_date) {
                        const now = new Date();
                        const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                        const mOutParts = b.move_out_date.split('-');
                        const mOutUtc = Date.UTC(parseInt(mOutParts[0]), parseInt(mOutParts[1]) - 1, parseInt(mOutParts[2]));
                        const diffTime = mOutUtc - todayUtc;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays < 30) {
                          isWithin30Days = true;
                        }
                      }
                      
                      return (
                        <div className="flex flex-col items-start gap-1">
                          {b.move_out_date && (
                            <span className="text-xs text-slate-700 font-medium">
                              {format(new Date(b.move_out_date + 'T00:00:00'), 'MMM d, yyyy')}
                            </span>
                          )}
                          {!isWithin30Days && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setSelectedBookingForMoveOut(b);
                                setModalMoveOutDate(b.move_out_date || '');
                              }}
                              className="text-[10px] h-6 px-2 rounded-lg text-primary hover:text-primary"
                            >
                              {b.move_out_date ? 'Change Date' : 'Set Move-out Date'}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {b.end_lease ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                        <CheckCircle className="w-3.5 h-3.5 text-slate-500" /> Lease Ended
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.lease_pdf_url ? (
                      <div className="inline-flex items-center gap-3">
                        <a
                          href={b.lease_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" /> View
                        </a>
                        <a
                          href={b.lease_pdf_url}
                          download={`lease_${b.id}.pdf`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          title="Download lease"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Pending...</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${agentSigned ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {agentSigned ? <CheckCircle className="w-3.5 h-3.5" /> : <Hourglass className="w-3.5 h-3.5" />}
                      {agentSigned ? 'Signed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const moveInDateObj = new Date(b.move_in_date + 'T00:00:00');
                      const todayDateObj = new Date();
                      todayDateObj.setHours(0, 0, 0, 0);
                      const isMoveInArrived = todayDateObj >= moveInDateObj;

                      if (!isMoveInArrived) {
                        return <span className="text-xs text-muted-foreground italic">Awaits Move-in</span>;
                      }

                      if (b.inspection_report) {
                        const needsSign = !b.inspection_report.tenantSignature;
                        return (
                          <div className="flex flex-col gap-1 items-start">
                            {needsSign ? (
                              <span className="text-xs text-amber-600 font-semibold flex items-center gap-1 animate-pulse">
                                <Hourglass className="w-3 h-3" /> Under Column to Sign
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Generated
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-[10px] h-6 px-2 rounded-lg"
                                onClick={() => {
                                  setInspectionBooking(b);
                                  setInspectionSelectedSignature?.(userProfile?.signatures?.[0] || '');
                                }}
                              >
                                {needsSign ? 'Sign Report' : 'View Report'}
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                title="Download PDF"
                                onClick={async () => {
                                  try {
                                    const { generateBeautifulInspectionPDF } = await import('../utils/inspectionPdfGenerator');
                                    await generateBeautifulInspectionPDF(
                                      b,
                                      b.inspection_report,
                                      listing?.title || 'Property'
                                    );
                                    toast.success('Inspection report PDF downloaded');
                                  } catch (pdfErr) {
                                    toast.error('Failed to export PDF');
                                  }
                                }}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              {b.inspection_report?.pdfUrl && (
                                <a
                                  href={b.inspection_report.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  title="View Report PDF"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return <span className="text-xs text-muted-foreground italic">Pending Owner</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {b.move_out_date ? (
                      b.move_out_report ? (
                        (() => {
                          const tenantNeedsSign = !b.move_out_report?.tenantSignature;
                          return (
                            <div className="flex flex-col gap-2 items-start">
                              <span className={`text-xs font-semibold ${tenantNeedsSign ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {tenantNeedsSign ? 'Under Column to Sign' : 'Available'}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="text-[10px] h-6 px-2 rounded-lg"
                                  onClick={() => setMoveOutBooking(b)}
                                >
                                  {tenantNeedsSign ? 'Sign Report' : 'View Report'}
                                </Button>
                                {b.move_out_report?.pdfUrl && (
                                  <a
                                    href={b.move_out_report.pdfUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    title="Download Move-out Report"
                                    download={`move_out_report_${b.id}.pdf`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pending</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No move-out date</span>
                    )}
                  </td>
                  {/* Maintenance Requests cell */}
                  <td className="px-4 py-4 align-top">
                    <Button
                      size="xs"
                      variant="outline"
                      className="text-xs whitespace-nowrap px-3 py-2"
                      onClick={() => openViewMaintenanceModal(b)}
                    >
                      {(b.maintenance_requests || []).length > 0
                        ? `Show All (${b.maintenance_requests.length})`
                        : '+ New Request'}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(b.status === 'lease_pending' || (b.status === 'approved' && b.lease_status !== 'signed')) ? (
                      <SignLeaseButton booking={b} listing={listing} onSigned={() => {}} />
                    ) : b.status === 'approved' && totalAmount > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => handlePayment(b.id)}
                        disabled={payingId === b.id || !agentSigned}
                        title={agentSigned ? 'Proceed to payment' : 'Payment is available after the agent signs the agreement'}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-[0.98] py-1 px-2.5 h-auto whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {payingId === b.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {agentSigned ? `Pay $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Awaiting agent signature'}
                            <span className="text-[10px] font-normal opacity-90 ml-0.5"> mxn</span>
                          </span>
                        ) : (
                          <>
                            {agentSigned ? (
                              <>
                                Pay ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="text-[10px] font-normal opacity-90 ml-0.5"> mxn</span>
                              </>
                            ) : 'Awaiting agent signature'}
                          </>
                        )}
                      </Button>
                    ) : b.status === 'confirmed' ? (
                      <span className="text-xs text-emerald-600 font-medium">Completed</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )}
  </div>
  );
}

// ── Payments tab ──────────────────────────────────────────────────────────────
function PaymentsTab({ payments = [], bookings = [], listings = [], isLoading }) {
  const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const filteredPayments = payments.filter(p => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const booking = bookingMap[p.booking_id];
    const listing = listingMap[p.listing_id];
    return [
      listing?.title,
      listing?.address,
      p.stripe_payment_intent_id,
      p.stripe_session_id,
      p.currency,
      p.status,
      booking?.owner_email,
    ]
      .filter(Boolean)
      .some(value => value.toString().toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search payments by property, owner, or transaction"
            className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="payments-page-size" className="font-medium">Show</label>
          <select
            id="payments-page-size"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {[10, 15, 25].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-lg">No payments found</p>
            <p className="text-muted-foreground text-sm mt-1">Adjust the search or check back later.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Transaction ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedPayments.map(p => {
                const booking = bookingMap[p.booking_id];
                const listing = listingMap[p.listing_id];
                const ownerEmail = booking?.owner_email || listing?.owner_email || '—';
                const ownerName = listing?.owner_name || 'Owner';
                const amountUsd = p.amount_centavos ? (p.amount_centavos / 100) : 0;
                const datePart = p.created_date ? format(new Date(p.created_date), 'MMMM d, yyyy') : 'N/A';
                const timePart = p.created_date ? format(new Date(p.created_date), 'h:mm a') : '';

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {listingMap[p.listing_id]?.title ? (
                        <Link to={`/listings/${p.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {listingMap[p.listing_id].title} <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown Property</span>
                      )}
                      {p.payment_for_month_year && (
                        <div className="text-xs font-semibold text-emerald-600 mt-1 whitespace-nowrap">
                          Period: {p.payment_for_month_year}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{ownerName}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{datePart}</div>
                      {timePart && <div className="text-xs text-muted-foreground/60 mt-0.5">{timePart}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground break-all">
                      {p.stripe_payment_intent_id || p.stripe_session_id || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monthly Rent Payments tab ──────────────────────────────────────────────────
function MonthlyRentPaymentsTab({ bookings = [], listings = [], payments = [] }) {
  const activeBookings = bookings.filter(b => b.status === 'confirmed');
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));

  const [payingBookingId, setPayingBookingId] = useState(null);

  const handlePayMonthlyRent = async (bookingId) => {
    setPayingBookingId(bookingId);
    try {
      const res = await supabase.functions.invoke('stripe-checkout', {
        body: JSON.stringify({
          bookingId,
          origin: window.location.origin,
          paymentType: 'monthly_rent'
        })
      });

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try {
          data = await res.json();
        } catch (err) {
          console.warn('Response is not JSON, using raw object:', err);
        }
      }

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      console.error(err);
      toast.error('Payment checkout failed');
    } finally {
      setPayingBookingId(null);
    }
  };

  if (activeBookings.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-slate-100 shadow-sm">
        <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800">No Active Bookings</h3>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm mt-1">
          Once your booking is confirmed, you will be able to make subsequent monthly rent payments here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Monthly Rent</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Next Payment Period</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activeBookings.map(booking => {
              const listing = listingMap[booking.listing_id];
              const agreement = booking.agreement_conditions || {};
              const rentAmount = parseFloat((agreement.monthlyRent || '').toString().replace(/[^0-9.]/g, '')) || 0;
              
              // Count existing payments for this booking (only monthly rents, excluding initial booking payment)
              const bookingPayments = payments.filter(p => p.booking_id === booking.id && p.payment_type === 'monthly_rent');
              const monthsPaid = bookingPayments.length;

              // Calculate start and end date of the upcoming billing period
              let paymentRangeText = 'N/A';
              let isButtonEnabled = true;
              let activationDateText = '';
              let isLastMonthPaid = false;
              let displayRentAmount = rentAmount;
              
              if (booking.move_in_date) {
                try {
                  const moveIn = new Date(booking.move_in_date);
                  // Calculate upcoming monthly billing period
                  // If monthsPaid === 0, the next upcoming rent payment should start covering from month index 2 onwards
                  // since months 0 and 1 (first + last month rent) were already paid in the booking checkout.
                  const targetMonthStart = moveIn.getUTCMonth() + monthsPaid + 2;
                  const targetMonthEnd = moveIn.getUTCMonth() + monthsPaid + 3;

                  const startDate = new Date(Date.UTC(moveIn.getUTCFullYear(), targetMonthStart, moveIn.getUTCDate()));
                  const endDate = new Date(Date.UTC(moveIn.getUTCFullYear(), targetMonthEnd, moveIn.getUTCDate()));

                  const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ];

                  let adjustedEndDate = new Date(endDate);
                  displayRentAmount = rentAmount;

                  if (booking.move_out_date) {
                    const moveOut = new Date(booking.move_out_date);
                    // If start of this billing period is already past/at the move out date, it means we have fully covered up to move out
                    if (startDate >= moveOut) {
                      isLastMonthPaid = true;
                      isButtonEnabled = false;
                    } 
                    // If move out falls inside this upcoming billing period, cap the end date of this period to the move out date
                    else if (moveOut > startDate && moveOut < endDate) {
                      adjustedEndDate = moveOut;
                      // Pro-rate the rent by days
                      const diffTime = Math.abs(adjustedEndDate.getTime() - startDate.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const dailyRate = rentAmount / 30; // Assuming 30 days per month
                      displayRentAmount = dailyRate * diffDays;
                    }
                  }

                  const startDay = startDate.getUTCDate();
                  const startMonthName = monthNames[startDate.getUTCMonth()];
                  const startYear = startDate.getUTCFullYear();
                  
                  const endDay = adjustedEndDate.getUTCDate();
                  const endMonthName = monthNames[adjustedEndDate.getUTCMonth()];
                  const endYear = adjustedEndDate.getUTCFullYear();

                  paymentRangeText = `${startMonthName} ${startDay}, ${startYear} to ${endMonthName} ${endDay}, ${endYear}`;

                  // Disable button unless <= 3 days left
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);

                  const startMs = startDate.getTime();
                  const currentMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

                  const diffMs = startMs - currentMs;
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                   if (!isLastMonthPaid) {
                     isButtonEnabled = diffDays <= 3;
                   }

                  // 3 days before start date:
                  const activationDate = new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000);
                  const actDay = activationDate.getUTCDate();
                  const actMonthName = monthNames[activationDate.getUTCMonth()];
                  const actYear = activationDate.getUTCFullYear();
                  activationDateText = isLastMonthPaid 
                    ? 'Final month rent pre-paid' 
                    : `${actMonthName} ${actDay}, ${actYear}`;
                } catch (err) {
                  console.error('Error formatting range on UI:', err);
                }
              }

              return (
                <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800 text-sm">
                      {listing?.title ? (
                        <Link to={`/listings/${booking.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {listing.title} <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown Property</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{listing?.address || '—'}</div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700 text-sm">
                    ${displayRentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
                  </td>

                  <td className="px-4 py-4 text-slate-600 text-sm font-semibold">
                    {paymentRangeText}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {isLastMonthPaid ? (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 whitespace-nowrap">
                          Final month pre-paid (Move-out approaching)
                        </span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handlePayMonthlyRent(booking.id)}
                            disabled={payingBookingId === booking.id || !isButtonEnabled}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 rounded-lg text-xs"
                          >
                            {payingBookingId === booking.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-3.5 h-3.5" /> Pay Rent
                              </>
                            )}
                          </Button>
                          {!isButtonEnabled && (
                            <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 mt-1 whitespace-nowrap">
                              Available on {activationDateText}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Appointments tab ──────────────────────────────────────────────────────────
function AppointmentsTab({ user, listings = [] }) {
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));

  const { data: appointments = [], isLoading, refetch } = useQuery({
    queryKey: ['dashboard-appointments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('renter_id', user.id)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['appointments-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email');
      if (error) throw error;
      return data || [];
    }
  });
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  const handleAcceptSlot = async (appointmentId, selectedSlot) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: new Date(selectedSlot).toISOString(),
          owner_accepted: false,
          agent_scheduled_slots: []
        })
        .eq('id', appointmentId);
      if (error) throw error;
      toast.success('Slot chosen successfully! Awaiting owner confirmation.');
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept slot');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-slate-100 shadow-sm">
        <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800">No Appointments</h3>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm mt-1">
          You haven't requested any property viewing appointments yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-850 leading-relaxed shadow-sm font-medium">
        🛡️ <span className="font-bold text-amber-950">Protected Lead Policy:</span>
        <span className="block mt-1">
          ⚠️ If an owner, agent, or tenant attempts to complete a rental agreement outside PV Verified Rentals after being introduced through the platform, they may face legal consequences for breaching the platform's Terms of Service. Applicable commissions, platform fees, and other contractual obligations will remain payable, and PV Verified Rentals reserves the right to pursue all available legal remedies.
        </span>
      </div>

      <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Agent / Owner</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Date & Time</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {appointments.map(app => {
              const listing = listingMap[app.listing_id];
              const agent = profileMap[app.agent_id];
              const owner = profileMap[app.owner_id];
              const hostName = agent?.full_name || owner?.full_name || agent?.email || owner?.email || 'Host';

              return (
                <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800">
                      {listing?.title ? (
                        <Link to={`/listings/${app.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {listing.title} <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown Property</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{listing?.address || '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-700">{hostName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{agent ? 'Agent' : 'Owner'}</div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {app.appointment_date ? (
                      format(new Date(app.appointment_date), 'MMMM d, yyyy · h:mm a')
                    ) : (
                      <span className="text-amber-600 font-medium">To be scheduled</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {app.owner_accepted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Confirmed
                      </span>
                    ) : app.agent_scheduled_slots?.includes('approved_by_agent') ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 animate-pulse">
                        Awaiting Owner
                      </span>
                    ) : app.agent_scheduled_slots?.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                        Alternative Proposed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {app.agent_scheduled_slots?.length > 0 && !app.owner_accepted && (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Choose a suggested slot:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                          {app.agent_scheduled_slots.map((slot, index) => (
                            <Button
                              key={index}
                              size="xs"
                              variant="outline"
                              onClick={() => handleAcceptSlot(app.id, slot)}
                              className="text-xs border-amber-200 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-800 px-2 py-1 rounded"
                            >
                              {format(new Date(slot), 'MMM d, h:mm a')}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
}

// ── Reviews tab ───────────────────────────────────────────────────────────────
function ReviewsTab({ user, listings }) {
  const [reviewingId, setReviewingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['user-bookings-reviews', user.id],
    queryFn: () => base44.entities.Booking.filter({ renter_id: user.id }, '-created_date', 100),
    enabled: !!user.id,
  });

  const { data: existingReviews = [] } = useQuery({
    queryKey: ['all-reviews', user.id],
    queryFn: () => base44.entities.PropertyReview.filter({ reviewer_id: user.id }, '-created_date', 100),
    enabled: !!user.id,
  });

  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const reviewedListingIds = new Set(existingReviews.map(r => r.listing_id));

  // Deduplicate: one entry per listing that has at least one approved, confirmed, OR ended/resolved booking
  const approvedBookings = allBookings.filter(b =>
    b.status === 'approved' ||
    b.status === 'confirmed' ||
    b.status === 'resolved' ||
    b.status === 'ended' ||
    b.end_lease === true
  );
  const reviewableListingIds = [...new Set(approvedBookings.map(b => b.listing_id))];
  const filteredReviewableListingIds = reviewableListingIds.filter(listingId => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[listingId];
    return [listing?.title, listing?.address, listing?.neighborhood]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredReviewableListingIds.length / pageSize));
  const paginatedReviewableListingIds = filteredReviewableListingIds.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (isLoading) return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const searchAndPaginationControls = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search reviewable listings by title or neighborhood"
          className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <label htmlFor="reviews-page-size" className="font-medium">Show</label>
        <select
          id="reviews-page-size"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
        >
          {[5, 10, 15].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>per page</span>
      </div>
    </div>
  );

  if (filteredReviewableListingIds.length === 0) {
    return (
      <div className="space-y-4">
        {searchAndPaginationControls}
        <div className="text-center py-16">
          <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-lg">No reviewable listings found</p>
          <p className="text-muted-foreground text-sm mt-1">Try another search or wait until a booking is approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">You can review properties where your booking was approved or your lease has ended.</p>
      {searchAndPaginationControls}
      {paginatedReviewableListingIds.map(listingId => {
        const listing = listingMap[listingId];
        const alreadyReviewed = reviewedListingIds.has(listingId);
        const isOpen = reviewingId === listingId;

        return (
          <Card key={listingId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <Link to={`/listings/${listingId}`} className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1">
                  {listing?.title || 'Property'} <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </Link>
                {alreadyReviewed ? (
                  <Badge className="bg-accent/10 text-accent border-0 gap-1 text-xs">
                    <CheckCircle className="w-3 h-3" /> Reviewed
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={isOpen ? 'outline' : 'default'}
                    onClick={() => setReviewingId(isOpen ? null : listingId)}
                    className="gap-1.5 shrink-0"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {isOpen ? 'Cancel' : 'Leave Review'}
                  </Button>
                )}
              </div>
              {isOpen && !alreadyReviewed && (
                <div className="border-t pt-4">
                  <ReviewForm listing={listing || { id: listingId, title: 'Property' }} user={user} onDone={() => setReviewingId(null)} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('tenant_dashboard_active_tab') || 'favorites';
  });
  const { onboardingLoading, handleStripeOnboard } = useStripeOnboarding(user);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setAuthLoading(false));

    // Handle payment success/cancel redirects
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      });
      toast.success('Payment completed successfully! Your booking is now confirmed.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      toast.error('Payment checkout cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { favorites, favoriteIds, toggle } = useFavorites(user?.id);
  const [favoritesSearch, setFavoritesSearch] = useState('');
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesPageSize, setFavoritesPageSize] = useState(10);

  const { data: allListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['approved-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: myInquiries = [], isLoading: inquiriesLoading } = useQuery({
    queryKey: ['user-inquiries', user?.id],
    queryFn: () => base44.entities.Inquiry.filter({ tenant_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: myBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['user-bookings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('renter_id', user.id)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: myPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['user-payments', user?.id],
    queryFn: () => base44.entities.Payment.filter({ payer_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const savedListings = allListings.filter(l => favoriteIds.has(l.id));
  const debouncedFavoritesSearch = useDebouncedValue(favoritesSearch, 500);
  const filteredSavedListings = savedListings.filter(listing => {
    const query = debouncedFavoritesSearch.trim().toLowerCase();
    if (!query) return true;
    return [listing.title, listing.address, listing.neighborhood, listing.status]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const favoritesTotalPages = Math.max(1, Math.ceil(filteredSavedListings.length / favoritesPageSize));
  const paginatedSavedListings = filteredSavedListings.slice((favoritesPage - 1) * favoritesPageSize, favoritesPage * favoritesPageSize);

  useEffect(() => {
    if (favoritesPage > favoritesTotalPages) {
      setFavoritesPage(favoritesTotalPages);
    }
  }, [favoritesPage, favoritesTotalPages]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <User className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to view your dashboard</h2>
        <p className="text-muted-foreground mb-6 text-sm">Track your favorites, inquiries, and booking requests in one place.</p>
        <Button size="lg" onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StripeConnectBanner 
        user={user} 
        onboardingLoading={onboardingLoading} 
        handleStripeOnboard={handleStripeOnboard}
        title="Set up Your Payments"
        description="To receive referral commission connect your bank account through Stripe."
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              Welcome back{user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <StatCard icon={Heart} label="Saved Properties" value={savedListings.length} color="bg-rose-100 text-rose-600" />
        <StatCard icon={MessageSquare} label="Inquiries Sent" value={myInquiries.length} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Calendar} label="Booking Requests" value={myBookings.length} color="bg-amber-100 text-amber-600" />
      </div>

    

      {/* Tabs */}
      <Tabs className="text-sm" value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        localStorage.setItem('tenant_dashboard_active_tab', val);
      }}>
        <TabsList className="mb-8 flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl text-sm">
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="w-4 h-4" /> Favorites
            {savedListings.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {savedListings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <MessageSquare className="w-4 h-4" /> Inquiries
            {myInquiries.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {myInquiries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="w-4 h-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Payments
            {myPayments.length > 0 && (
              <span className="ml-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {myPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly-payments" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Monthly Payments
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="w-4 h-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="referral-payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Referral Earnings
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Verification
            {user.id_verified && (
              <span className="ml-1 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">✓</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="pt-6">
          {listingsLoading ? (
            <div className="space-y-5">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={favoritesSearch}
                    onChange={(e) => { setFavoritesSearch(e.target.value); setFavoritesPage(1); }}
                    placeholder="Search favorites by title, neighborhood, or status"
                    className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <label htmlFor="favorites-page-size" className="font-medium">Show</label>
                  <select
                    id="favorites-page-size"
                    value={favoritesPageSize}
                    onChange={(e) => { setFavoritesPageSize(Number(e.target.value)); setFavoritesPage(1); }}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    {[6, 12, 18].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              {filteredSavedListings.length === 0 ? (
                <div className="text-center py-16">
                  <Heart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-lg">No saved properties found</p>
                  <p className="text-muted-foreground text-sm mt-1">Try another search or save a new listing.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedSavedListings.map(listing => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={(id) => toggle.mutate(id)}
                      />
                    ))}
                  </div>
                  {favoritesTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                      <div>Page {favoritesPage} of {favoritesTotalPages}</div>
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={favoritesPage === 1} onClick={() => setFavoritesPage(favoritesPage - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={favoritesPage === favoritesTotalPages} onClick={() => setFavoritesPage(favoritesPage + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* Inquiries Tab */}
        <TabsContent value="inquiries" className="pt-6">
          {inquiriesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : myInquiries.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No inquiries sent yet</p>
              <p className="text-muted-foreground text-sm mt-1">Contact an agent from any listing page to get started.</p>
              <Link to="/listings"><Button className="mt-5 gap-2"><Search className="w-4 h-4" /> Browse Listings</Button></Link>
            </div>
          ) : (
            <InquiryKanban inquiries={myInquiries} />
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="pt-6">
          <BookingsTab bookings={myBookings} isLoading={bookingsLoading} listings={allListings} userEmail={user.email} userProfile={user} />
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="pt-6">
          <AppointmentsTab user={user} listings={allListings} />
        </TabsContent>

        <TabsContent value="chat" className="pt-6">
          <PaidBookingChat bookings={myBookings} listings={allListings} currentUser={{ ...user, role: 'renter' }} />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="pt-6">
          <PaymentsTab payments={myPayments} bookings={myBookings} listings={allListings} isLoading={paymentsLoading} />
        </TabsContent>

        {/* Monthly Payments Tab */}
        <TabsContent value="monthly-payments" className="pt-6">
          <MonthlyRentPaymentsTab bookings={myBookings} listings={allListings} payments={myPayments} />
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="pt-6">
          <ReviewsTab user={user} listings={allListings} />
        </TabsContent>

        {/* Referral Payments Tab */}
        <TabsContent value="referral-payments" className="pt-6">
          <ReferralPaymentsTab userId={user.id} userEmail={user.email} listings={allListings} />
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="pt-6">
          <TenantVerification user={user} onUserUpdated={setUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}