import { supabase } from '@/lib/supabase'

export const auditLogger = {
  async log(action, details = {}) {
    try {
      // Get current authenticated user session
      const { data: { user } } = await supabase.auth.getUser()

      const logData = {
        user_id: user?.id || null,
        action,
        entity_type: details.entityType || null,
        entity_id: details.entityId ? String(details.entityId) : null
      }

      const { error } = await supabase.from('audit_logs').insert(logData)
      if (error) {
        console.error('[AuditLogger] Error writing audit log to Database:', error)
      }
    } catch (err) {
      console.error('[AuditLogger] Failed to create audit log:', err)
    }
  }
}
