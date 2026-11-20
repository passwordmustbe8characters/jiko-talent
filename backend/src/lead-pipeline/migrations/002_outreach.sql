-- Migration 002: company kinds (employer vs channel) and draft provenance.
BEGIN;

-- 'channel' = a site students can register or apply on (job boards, remote marketplaces), not an employer to pitch
ALTER TABLE leads ADD COLUMN kind varchar(15) NOT NULL DEFAULT 'employer'
  CHECK (kind IN ('employer', 'channel'));
CREATE INDEX idx_leads_kind ON leads(kind) WHERE deleted_at IS NULL;

-- which verified facts an email draft was based on, so you can check its claims
ALTER TABLE drafts ADD COLUMN based_on_fact_ids uuid[] NOT NULL DEFAULT '{}';

COMMIT;

-- ROLLBACK (manual):
-- ALTER TABLE drafts DROP COLUMN based_on_fact_ids;
-- DROP INDEX IF EXISTS idx_leads_kind; ALTER TABLE leads DROP COLUMN kind;
