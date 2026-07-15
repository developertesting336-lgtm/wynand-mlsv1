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
const VAPID_PUBLIC_KEY = 'BCCW5bb7HgyST570k0LwvSLoUH6GkNMLYmGek5eXA+DZMn8J5Rt9EfdszmMqg60tpcYuP9jmXq3xDPAdAebb538';

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

    // 5. Store subscription credentials in Supabase
    const { data, error } = await supabase
      .from('user_push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth
        },
        { onConflict: 'endpoint' }
      )
      .select();

    if (error) throw error;

    return { success: true, subscription: data };
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    return { success: false, error: err.message };
  }
}

export async function checkPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  
  if (Notification.permission === 'default') {
    return 'unsubscribed';
  }
  
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return 'unsubscribed';
    }
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return 'unsubscribed';
    }
    return Notification.permission === 'granted' ? 'subscribed' : 'denied';
  } catch (err) {
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
