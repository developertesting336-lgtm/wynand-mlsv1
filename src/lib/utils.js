import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const SUBSCRIPTION_GRACE_DAYS = 32;

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSubscriptionActive(subscription) {
  if (!subscription) return false;

  const now = Date.now();
  const periodEnd = parseDate(subscription.current_period_end);
  if (periodEnd && periodEnd.getTime() > now) return true;

  const paymentDate = parseDate(subscription.last_payment_date);
  if (paymentDate) {
    const maxAge = SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000;
    return now - paymentDate.getTime() <= maxAge;
  }

  return false;
}

export function selectSubscription(subscriptionData) {
  if (!subscriptionData) return null;
  if (Array.isArray(subscriptionData)) {
    return subscriptionData.find(s => s.status === 'active') || subscriptionData[0] || null;
  }
  return subscriptionData;
}

export const isIframe = window.self !== window.top;
