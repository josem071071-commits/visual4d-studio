BEGIN;

ALTER TABLE projects
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  ADD COLUMN final_design_version_id TEXT;

ALTER TABLE approvals
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'AI_PROPOSED' CHECK (origin IN ('USER_APPROVED','AI_PROPOSED','SYSTEM_VALIDATED')),
  ADD COLUMN approved_by_user_id TEXT REFERENCES users(id),
  ADD COLUMN approved_at TIMESTAMPTZ;

ALTER TABLE approvals
  ADD CONSTRAINT approvals_user_approval_consistency_chk
  CHECK (
    (origin = 'USER_APPROVED' AND decision = 'APPROVED' AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
    OR origin <> 'USER_APPROVED'
  );

CREATE TABLE design_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

ALTER TABLE verification_versions
  ADD COLUMN design_version_id TEXT;

ALTER TABLE verification_versions
  ADD CONSTRAINT verification_design_fk FOREIGN KEY (design_version_id) REFERENCES design_versions(id);

ALTER TABLE projects
  ADD CONSTRAINT projects_final_design_fk FOREIGN KEY (final_design_version_id) REFERENCES design_versions(id);

CREATE TABLE idempotency_keys (
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  operation TEXT NOT NULL,
  request_id TEXT NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_user_id, operation, request_id)
);

CREATE INDEX approvals_approved_by_user_idx ON approvals(approved_by_user_id);
CREATE INDEX design_versions_project_idx ON design_versions(project_id, version_number DESC);

COMMIT;
