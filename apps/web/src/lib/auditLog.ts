import { SupabaseClient } from '@supabase/supabase-js'

type AuditEntry = {
  organizationId: string
  caseId?: string | null
  actorId: string
  actorRole: string
  action: string
  entityType: string
  entityId?: string | null
  payload?: Record<string, unknown>
}

// Requiere el cliente service-role (RLS de audit_log no permite INSERT directo).
export async function logAudit(supabase: SupabaseClient, entry: AuditEntry) {
  const { error } = await supabase.from('audit_log').insert({
    organization_id: entry.organizationId,
    case_id: entry.caseId ?? null,
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    payload: entry.payload ?? null,
  })
  if (error) console.error('[audit_log] error:', error.message)
}
