import { supabase } from '@/lib/supabase';

// Base64URL VAPID public key helper
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Enter your VAPID Public Key here
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function registerPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser.');
    return { success: false, error: 'unsupported' };
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered with scope:', registration.scope);

    // 2. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'permission_denied' };
    }

    // 3. Subscribe to Browser Push Service
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    // 4. Extract credentials
    const rawSubscription = JSON.parse(JSON.stringify(subscription));
    const endpoint = rawSubscription.endpoint;
    const p256dh = rawSubscription.keys.p256dh;
    const auth = rawSubscription.keys.auth;

    // 5. Delete any old subscription records for this user_id to ensure strictly 1 row per user
    await supabase
      .from('user_push_subscriptions')
      .delete()
      .eq('user_id', userId);

    // 6. Store new subscription credentials in Supabase
    const { data, error } = await supabase
      .from('user_push_subscriptions')
      .insert({
        user_id: userId,
        endpoint,
        p256dh,
        auth
      })
      .select();

    if (error) throw error;

    return { success: true, subscription: data };
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    return { success: false, error: err.message };
  }
}

export async function checkPushSubscription(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }

  // 1. If browser permission is default (never asked / reset), user is unsubscribed on this browser
  if (Notification.permission === 'default') {
    return 'unsubscribed';
  }

  // 2. If browser permission is denied, user denied notifications
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return 'unsubscribed';
    }

    const subscription = await registration.pushManager.getSubscription();
    // 3. If browser has no active push subscription (e.g. cookies/site data cleared)
    if (!subscription) {
      return 'unsubscribed';
    }

    // 4. Browser HAS active subscription & permission. Check/sync with Supabase DB for this user
    if (userId) {
      const rawSubscription = JSON.parse(JSON.stringify(subscription));
      const endpoint = rawSubscription.endpoint;

      const { data } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .maybeSingle();

      // If DB record is missing for this user & device endpoint, delete old user entries & insert new one
      if (!data) {
        await supabase
          .from('user_push_subscriptions')
          .delete()
          .eq('user_id', userId);

        await supabase
          .from('user_push_subscriptions')
          .insert({
            user_id: userId,
            endpoint: endpoint,
            p256dh: rawSubscription.keys?.p256dh,
            auth: rawSubscription.keys?.auth
          });
      }
    }

    return 'subscribed';
  } catch (err) {
    console.error('Error checking push subscription:', err);
    return 'unsubscribed';
  }
}


export async function unsubscribePushNotifications(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // Unsubscribe from push service
      await subscription.unsubscribe();

      // Delete from database
      await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }

    return { success: true };
  } catch (err) {
    console.error('Error unsubscribing from push notifications:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send a web-push notification to a specific user via the `send-push` edge function.
 * The edge function also inserts a row into the notifications table (in-app bell).
 * The VAPID private key stays securely on the server.
 *
 * @param {string} userId  - The recipient's profile UUID
 * @param {string} title   - Notification title
 * @param {string} body    - Notification body text
 * @param {string} [url]   - Optional URL to open when the notification is clicked
 * @param {string} [type]  - Notification type stored in DB (default: 'general')
 */
export async function sendPushNotification(userId, title, body, url = '/', type = 'general') {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { user_id: userId, title, body, url, type },
    });

    if (error) {
      console.error('send-push edge function error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('sendPushNotification error:', err);
    return { success: false, error: err.message };
  }
}


