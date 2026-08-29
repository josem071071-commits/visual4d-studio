BEGIN;

ALTER TABLE idempotency_keys
  ALTER COLUMN result_json DROP NOT NULL,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('IN_PROGRESS','COMPLETED','FAILED_RETRYABLE')),
  ADD COLUMN error_code TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE approval_grants (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[A-Fa-f0-9]{64}$'),
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('ANALYSIS','STRUCTURE','RESOURCES','ART_DIRECTION','VERIFICATION')),
  artifact_version_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ISSUED','CLAIMED','CONSUMED')),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((state='ISSUED' AND claimed_at IS NULL AND consumed_at IS NULL)
      OR (state='CLAIMED' AND claimed_at IS NOT NULL AND consumed_at IS NULL)
      OR (state='CONSUMED' AND claimed_at IS NOT NULL AND consumed_at IS NOT NULL))
);
CREATE INDEX approval_grants_lookup_idx ON approval_grants(user_id,project_id,artifact_kind,artifact_version_id,state);
CREATE INDEX approval_grants_expiry_idx ON approval_grants(expires_at);

COMMIT;
