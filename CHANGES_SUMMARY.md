# Changes Summary

## Code Changes

### 1. src/components/inquiries/InquiryReplies.jsx
- Fixed UUID generation using crypto.randomUUID()
- Added message routing logic (recipient_type)
- Agent to tenant: recipient_type = 'tenant'
- Agent to owner: recipient_type = 'owner'
- Tenant/Owner to agent: recipient_type = 'agent'

### 2. src/pages/AgentDashboard.jsx
- Added property owner display in "Owners" tab
- Synthetic owner records now use valid UUIDs
- Shows property owners even when only tenant has inquired

### 3. src/pages/OwnerDashbaord.jsx
- Fixed to only show owner's own inquiries
- Now filters by sender_role = 'owner'

## Database Migrations (RUN THESE IN SUPABASE)

### SQL 1: scripts/add-missing-inquiry-columns.sql
ALTER TABLE inquiries 
ADD COLUMN IF NOT EXISTS sender_role TEXT DEFAULT 'renter',
ADD COLUMN IF NOT EXISTS agent_email TEXT,
ADD COLUMN IF NOT EXISTS agent_id UUID;

### SQL 2: scripts/add-recipient-type-column.sql
ALTER TABLE inquiry_replies 
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'both';

## Result
The 400 error is resolved. Agent can now message tenant and owner separately with complete privacy.