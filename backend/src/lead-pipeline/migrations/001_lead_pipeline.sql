-- =====================================================================
-- Jiko Talent: private lead pipeline (migration 001)
-- Run with the native pg driver:  await client.query(fs.readFileSync(file, 'utf8'))
-- Reads jiko_students but never modifies it.
-- jiko_students.id is SERIAL (integer), so student references are integer FKs.
-- New tables use uuid primary keys.
-- =====================================================================

BEGIN;

-- ---------- helper: keep updated_at fresh ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- 1. batches ----------
CREATE TABLE batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(150) NOT NULL,
  role_family   varchar(60)  NOT NULL,
  defining_tags text[]       NOT NULL DEFAULT '{}',
  status        varchar(20)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','researching','ready_for_review','archived')),
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- ---------- 2. student_tags (one row per student, reused across batches) ----------
CREATE TABLE student_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       integer NOT NULL UNIQUE REFERENCES jiko_students(id) ON DELETE CASCADE,
  role_family      varchar(60),
  tech_tags        text[]  NOT NULL DEFAULT '{}',   -- normalized: 'react', 'nodejs', 'postgresql'
  domain_tags      text[]  NOT NULL DEFAULT '{}',   -- from project topic: 'fintech', 'health'
  project_summary  text,                            -- short, no personal details
  outreach_consent boolean NOT NULL DEFAULT false,  -- student agreed to profile being shared
  consent_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. batch_students (link) ----------
CREATE TABLE batch_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   uuid    NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id integer NOT NULL REFERENCES jiko_students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

-- ---------- 4. leads (one row per company, unique by domain) ----------
CREATE TABLE leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   varchar(200) NOT NULL,
  domain         varchar(255) NOT NULL UNIQUE,      -- e.g. 'paystack.com', lowercase, no www
  website_url    text,
  region         varchar(15)  NOT NULL CHECK (region IN ('local','international')),
  country        varchar(80),
  city           varchar(80),
  industry       varchar(100),
  summary        text,
  company_size   varchar(40),
  funding_stage  varchar(40),
  tech_stack     text[] NOT NULL DEFAULT '{}',
  hiring_signal  varchar(10) NOT NULL DEFAULT 'unknown'
                 CHECK (hiring_signal IN ('unknown','none','possible','active')),
  status         varchar(15) NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','reviewing','approved','contacted','replied','closed','rejected')),
  reject_reason  text,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- 5. batch_leads (a lead can serve several batches) ----------
CREATE TABLE batch_leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  lead_id    uuid NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,
  found_via  text,                                  -- search query that surfaced it
  fit_note   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, lead_id)
);

-- ---------- 6. web_cache (fetched pages = the evidence store) ----------
CREATE TABLE web_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL UNIQUE,
  title        text,
  content      text,                                -- cleaned page text
  content_hash char(64),
  http_status  integer,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- 7. search_cache (never pay twice for the same query) ----------
CREATE TABLE search_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     varchar(30) NOT NULL,                -- 'tavily','exa','serper'
  query        text        NOT NULL,
  results      jsonb       NOT NULL,
  result_count integer     NOT NULL DEFAULT 0,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, query)
);

-- ---------- 8. lead_facts (every claim needs a source + quote) ----------
CREATE TABLE lead_facts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category       varchar(20) NOT NULL DEFAULT 'other'
                 CHECK (category IN ('overview','tech_stack','hiring','funding','culture','contact','other')),
  claim          text NOT NULL,
  source_url     text NOT NULL,
  evidence_quote text NOT NULL,                     -- exact text from the page
  web_cache_id   uuid REFERENCES web_cache(id) ON DELETE SET NULL,
  fetched_at     timestamptz NOT NULL,
  verified       boolean NOT NULL DEFAULT false,    -- set by code: quote found in stored page
  verified_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- 9. lead_contacts (no row = nothing found; never guessed) ----------
CREATE TABLE lead_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  full_name   varchar(150),
  job_title   varchar(150),
  email       varchar(255),
  phone       varchar(30),
  profile_url text,
  source_url  text NOT NULL,
  confidence  varchar(20) NOT NULL DEFAULT 'unverified'
              CHECK (confidence IN ('on_company_site','third_party','unverified')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_lead_contacts_email ON lead_contacts(lead_id, lower(email)) WHERE email IS NOT NULL;

-- ---------- 10. matches (student x lead, inside a batch) ----------
CREATE TABLE matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid    NOT NULL,
  lead_id       uuid    NOT NULL,
  student_id    integer NOT NULL,
  score         numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  stack_score   numeric(5,2) NOT NULL DEFAULT 0,
  domain_bonus  numeric(5,2) NOT NULL DEFAULT 0,
  matched_tags  text[] NOT NULL DEFAULT '{}',
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, lead_id, student_id),
  FOREIGN KEY (batch_id, lead_id)    REFERENCES batch_leads(batch_id, lead_id)       ON DELETE CASCADE,
  FOREIGN KEY (batch_id, student_id) REFERENCES batch_students(batch_id, student_id) ON DELETE CASCADE
);

-- ---------- 11. drafts (outreach emails; draft only, never auto-sent) ----------
CREATE TABLE drafts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid NOT NULL,
  lead_id             uuid NOT NULL,
  contact_id          uuid REFERENCES lead_contacts(id) ON DELETE SET NULL,
  subject             varchar(300),
  body                text NOT NULL,
  featured_student_ids integer[] NOT NULL DEFAULT '{}',
  recommended_channel varchar(15)
                      CHECK (recommended_channel IN ('email','call','whatsapp','linkedin','other')),
  channel_reasoning   text,
  model               varchar(60),
  edited              boolean NOT NULL DEFAULT false,
  status              varchar(15) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','approved','sent','discarded')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, lead_id) REFERENCES batch_leads(batch_id, lead_id) ON DELETE CASCADE
);

-- ---------- 12. outreach_log (what you actually did + what happened) ----------
CREATE TABLE outreach_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  draft_id    uuid REFERENCES drafts(id) ON DELETE SET NULL,
  contact_id  uuid REFERENCES lead_contacts(id) ON DELETE SET NULL,
  student_id  integer REFERENCES jiko_students(id) ON DELETE SET NULL,  -- when an outcome is about one student
  channel     varchar(15) NOT NULL
              CHECK (channel IN ('email','call','whatsapp','linkedin','other')),
  event_type  varchar(20) NOT NULL
              CHECK (event_type IN ('sent','followed_up','called','replied','interview','offer','declined','no_response')),
  notes       text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 13. api_usage (stop before free limits are hit) ----------
CREATE TABLE api_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      varchar(30) NOT NULL,               -- 'tavily','exa','serper','groq','openai'
  period        char(7)     NOT NULL,               -- 'YYYY-MM'
  units_used    integer     NOT NULL DEFAULT 0,
  monthly_limit integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, period)
);

-- ---------- indexes (only the ones that earn their keep) ----------
CREATE INDEX idx_batch_students_student ON batch_students(student_id);
CREATE INDEX idx_batch_leads_lead       ON batch_leads(lead_id);
CREATE INDEX idx_leads_status           ON leads(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_facts_lead        ON lead_facts(lead_id);
CREATE INDEX idx_lead_facts_unverified  ON lead_facts(lead_id) WHERE verified = false;
CREATE INDEX idx_matches_lead_score     ON matches(batch_id, lead_id, score DESC);
CREATE INDEX idx_matches_student        ON matches(student_id);
CREATE INDEX idx_drafts_lead            ON drafts(lead_id, created_at DESC);
CREATE INDEX idx_outreach_lead          ON outreach_log(lead_id, occurred_at DESC);

-- ---------- updated_at triggers ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'batches','student_tags','batch_students','leads','batch_leads','web_cache',
    'search_cache','lead_facts','lead_contacts','matches','drafts','outreach_log','api_usage'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (run manually if needed; drops only the new tables):
-- DROP TABLE IF EXISTS api_usage, outreach_log, drafts, matches, lead_contacts,
--   lead_facts, search_cache, web_cache, batch_leads, leads, batch_students,
--   student_tags, batches CASCADE;
-- DROP FUNCTION IF EXISTS set_updated_at();
-- ---------------------------------------------------------------------
