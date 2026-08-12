import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Link2, ExternalLink, Pencil, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ReferralLinkCard({ agent, listings, onCodeUpdated }) {
  const [copied, setCopied] = useState(false);
  const [selectedListing, setSelectedListing] = useState('');
  const [editing, setEditing] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Use stored referral_code from profile, fallback to email-based default
  const storedCode = agent?.referral_code || '';
  const defaultCode = agent?.email
    ? 'REF-' + agent.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    : '';
  const displayCode = storedCode || defaultCode;

  const base = window.location.origin;
  const listingPath = selectedListing ? `/listings/${selectedListing}` : '/listings';
  const referralUrl = `${base}${listingPath}?agent_ref=${agent?.id || ''}`;

  const copy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    setCodeInput(storedCode || '');
    setEditing(true);
    setCodeError('');
  };

  const cancelEditing = () => {
    setEditing(false);
    setCodeInput('');
    setCodeError('');
  };

  const checkCodeUnique = async (code) => {
    const users = await base44.entities.User.filter({ referral_code: code });
    // If any user has this code and it's not the current agent, it's a duplicate
    return !users.some(u => u.id !== agent.id);
  };

  const saveCode = async () => {
    const trimmed = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (trimmed.length < 8) {
      setCodeError('Code must be at least 8 characters');
      return;
    }
    setChecking(true);
    setCodeError('');
    try {
      const isUnique = await checkCodeUnique(trimmed);
      if (!isUnique) {
        setCodeError('This code is already taken. Please choose another.');
        setChecking(false);
        return;
      }
      setSaving(true);
      const updated = await base44.entities.User.update(agent.id, { referral_code: trimmed });
      console.log('Referral code saved successfully:', updated);
      toast.success('Referral code updated!');
      setEditing(false);
      setCodeInput('');
      // Immediately update local agent object so UI refreshes
      if (updated?.referral_code) {
        onCodeUpdated?.();
      }
    } catch (err) {
      console.error('Failed to save referral code:', err);
      const msg = err?.message || err?.data?.message || 'Failed to save referral code. Make sure the referral_code column exists in the profiles table.';
      toast.error(msg);
      setCodeError(msg);
    } finally {
      setSaving(false);
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Your Referral Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Link to (optional — leave blank for all listings)
          </label>
          <select
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={selectedListing}
            onChange={e => setSelectedListing(e.target.value)}
          >
            <option value="">All Listings</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>



        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Share this link
          </label>
          <div className="flex gap-2">
            <Input value={referralUrl} readOnly className="text-xs font-mono bg-muted/50" />
            <Button size="sm" onClick={copy} className="shrink-0 gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          When a client clicks your link and fills in an inquiry or booking, their referral is automatically tracked to you.
        </p>
      </CardContent>
    </Card>
  );
}