import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { MessageSquare } from 'lucide-react';
import InquiryForm from './InquiryForm';
import ContactAgentForm from './ContactAgentForm';

export default function MobileCtaBar({ listing, ownerRole = 'owner', refCode = '', userRole, userVerified }) {
  const [open, setOpen] = useState(false);
  const hasAssignedAgent = !!(listing?.agent_email || listing?.agent_name || listing?.agent_phone);
  const renterUnverified = userRole === 'renter' && !userVerified;

  if (userRole === 'owner') return null;

  return (
    <>
      {/* Sticky bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-2xl px-4 py-3 flex gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-foreground">
            MXN ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2 h-12 px-5 shrink-0"
          onClick={() => { if (!renterUnverified) setOpen(true); }}
          disabled={renterUnverified}
        >
          <MessageSquare className="w-4 h-4" />
          {renterUnverified ? 'Verify to Inquire' : 'Inquire'}
        </Button>
      </div>

      {/* Inquiry drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="border-b pb-3">
            <DrawerTitle>Inquire About This Property</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 pt-4">
            {hasAssignedAgent ? (
              <ContactAgentForm listing={listing} ownerRole={ownerRole} refCode={refCode} onSubmitted={() => setOpen(false)} />
            ) : (
              <InquiryForm listing={listing} onSubmitted={() => setOpen(false)} ownerRole={ownerRole} refCode={refCode} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}