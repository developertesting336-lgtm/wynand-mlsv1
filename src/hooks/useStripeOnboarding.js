import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useStripeOnboarding(user) {
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Handle Stripe onboarding redirect check
  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success' && user?.email) {
      setOnboardingLoading(true);
      (async () => {
        try {
          const res = await supabase.functions.invoke('stripe-verify-onboarding', {
            body: JSON.stringify({ email: user.email })
          });
          const data = res.data;
          if (data.complete) {
            toast.success('Stripe Connect onboarding complete! You can now receive payments.');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
          } else {
            toast.error('Stripe onboarding was not completed. Please try again.');
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error(err);
          toast.error('Failed to verify Stripe onboarding status.');
        } finally {
          setOnboardingLoading(false);
        }
      })();
    }
  }, [user]);

  const handleStripeOnboard = async () => {

    if (!user?.email) {
      toast.error('Unable to start Stripe onboarding: email is missing.');
      return;
    }

    setOnboardingLoading(true);
    try {
      const res = await supabase.functions.invoke('stripe-onboard', {
        body: JSON.stringify({ email: user.email, origin: window.location.origin })
      });

      let data = res.data;
      try {
        if (res && typeof res.json === 'function') {
          data = await res.json();
        }
      } catch (parseErr) {
        data = res;
      }

      const ok = typeof res?.ok === 'boolean' ? res.ok : (data && !data.error);
      if (!ok) {
        toast.error((data && data.error) || 'Failed to start Stripe onboarding.');
        setOnboardingLoading(false);
        return;
      }

      if (data && data.url) {
        window.location.href = data.url;
        return;
      }

      toast.error((data && data.error) || 'Failed to start Stripe onboarding.');
    } catch (err) {
      console.error(err);
      toast.error('Network error starting Stripe onboarding.');
    } finally {
      setOnboardingLoading(false);
    }
  };

  return {
    onboardingLoading,
    handleStripeOnboard,
  };
}