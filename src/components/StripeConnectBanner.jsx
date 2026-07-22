import React from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';

export default function StripeConnectBanner({ 
  user, 
  onboardingLoading, 
  handleStripeOnboard, 
  title = 'Set up Your Payments',
  description = 'Connect your Stripe account to receive payments directly to your bank account.',
  buttonText = 'Connect Bank Account'
}) {
  if (!user) return null;

  if (!user.stripe_connect_id || !user.stripe_onboarding_complete) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-semibold text-amber-900 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            {title}
          </h4>
          <p className="text-xs text-amber-700 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
        <Button 
          onClick={handleStripeOnboard} 
          disabled={onboardingLoading}
          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:animate-none"
        >
          {onboardingLoading ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {buttonText}</span>
          ) : (
            buttonText
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 p-3 rounded-xl border border-green-200 bg-green-50/50 flex items-center gap-2 text-xs text-green-800">
      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
      <span>Bank account is connected through stripe.</span>
    </div>
  );
}