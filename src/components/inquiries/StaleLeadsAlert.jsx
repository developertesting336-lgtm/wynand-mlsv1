import React, { useState } from 'react';
import { AlertTriangle, X, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export default function StaleLeadsAlert({ inquiries, agentEmail, agentName }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);

  const stale = inquiries.filter(inq => {
    if (inq.status !== 'new') return false;
    const age = Date.now() - new Date(inq.created_date).getTime();
    return age > FORTY_EIGHT_HOURS_MS;
  });

  if (stale.length === 0 || dismissed) return null;

  const handleSendReminder = async () => {
    if (!agentEmail) return;
    setSending(true);
    const list = stale
      .map(inq => `• ${inq.name} — "${inq.listing_title || 'Unknown listing'}" (received ${formatDistanceToNow(new Date(inq.created_date), { addSuffix: true })})`)
      .join('\n');

    const res = await fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: agentEmail,
        subject: `⚠️ You have ${stale.length} lead${stale.length > 1 ? 's' : ''} waiting more than 48 hours`,
        body: `
<p>Hi ${agentName || 'there'},</p>
<p>The following lead${stale.length > 1 ? 's have' : ' has'} been sitting in <strong>New</strong> status for over 48 hours without follow-up:</p>
<pre style="background:#f9f9f9;padding:12px;border-radius:6px;font-size:13px;line-height:1.6">${list}</pre>
<p>Quick responses dramatically improve your conversion rate. Please reach out to these leads as soon as possible.</p>
<p><a href="${window.location.origin}/agent-dashboard" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to My Dashboard →</a></p>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
        `.trim(),
        fromEmail: process.env.VITE_APP_EMAIL || 'info@pvverified.com',
        fromName: 'PV Verified Rentals',
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to send email');

    toast.success('Reminder email sent to your inbox');
    setSending(false);
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900">
              {stale.length} lead{stale.length > 1 ? 's' : ''} waiting over 48 hours
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              {stale.length > 1 ? 'These prospects' : 'This prospect'} may go cold — follow up now to stay top of mind.
            </p>

            {expanded && (
              <ul className="mt-3 space-y-1.5">
                {stale.map(inq => (
                  <li key={inq.id} className="text-sm text-amber-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-medium">{inq.name}</span>
                    <span className="text-amber-600 truncate">— {inq.listing_title || 'Unknown listing'}</span>
                    <span className="text-amber-500 shrink-0 text-xs">
                      ({formatDistanceToNow(new Date(inq.created_date), { addSuffix: true })})
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Hide details</> : <><ChevronDown className="w-3 h-3" /> Show {stale.length} lead{stale.length > 1 ? 's' : ''}</>}
              </button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100 gap-1"
                onClick={handleSendReminder}
                disabled={sending}
              >
                <Mail className="w-3 h-3" />
                {sending ? 'Sending…' : 'Email me a reminder'}
              </Button>
            </div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-800 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}