import { SupabaseEntityAdapter } from '@/lib/supabase'
import { auth, emailIntegration, storageIntegration } from '@/lib/auth'

/**
 * Supabase-backed compatibility layer that mimics the base44 SDK interface.
 * All existing components continue to work without changes.
 */

// Entity adapters for all tables used in the app
const entityTableMap = {
  Listing: 'listings',
  Inquiry: 'inquiries',
  Booking: 'bookings',
  Favorite: 'favorites',
  User: 'profiles',
  AgentReferral: 'agent_referrals',
  AgentReview: 'agent_reviews',
  AgentSubscription: 'subscriptions',
  Subscription: 'subscriptions',
  BookingDate: 'booking_dates',
  CommissionPayout: 'commission_payouts',
  PropertyReview: 'property_reviews',
  SaleReferral: 'sale_referrals',
  Payment: 'payments',
  Verification: 'verifications',
  TenantVerification: 'verifications',
}

const entities = {}
for (const [entityName, tableName] of Object.entries(entityTableMap)) {
  entities[entityName] = new SupabaseEntityAdapter(tableName)
}

// Add redirectToLogin that triggers the auth modal via event
const authWithModal = {
  ...auth,
  redirectToLogin: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-auth-modal'))
    }
  }
}

export const base44 = {
  entities,
  auth: authWithModal,
  integrations: {
    Core: {
      SendEmail: emailIntegration.SendEmail,
      UploadFile: storageIntegration.UploadFile,
      InvokeLLM: async ({ prompt, ...rest }) => {
        // LLM placeholder – connect to your preferred AI API
        if (import.meta.env.DEV) {
          console.warn('🤖 LLM call (dev placeholder):', prompt)
          return { content: 'LLM not configured' }
        }
        try {
          const response = await fetch('/api/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, ...rest })
          })
          return await response.json()
        } catch (err) {
          console.error('LLM call failed:', err)
          throw { status: 500, message: 'Failed to invoke LLM' }
        }
      }
    }
  }
}