BEGIN;

-- Only one ACTIVE identity version may exist per institution.
CREATE UNIQUE INDEX identity_versions_one_active_per_institution
  ON identity_versions (institution_id)
  WHERE status = 'ACTIVE';

-- Provenance consistency: approved state and source references are internally coherent.
ALTER TABLE provenance_records
  ADD CONSTRAINT provenance_approved_at_consistency_chk
  CHECK ((approved AND approved_at IS NOT NULL) OR (NOT approved AND approved_at IS NULL));

ALTER TABLE provenance_records
  ADD CONSTRAINT provenance_source_id_required_chk
  CHECK (
    source_type IN ('USER_INPUT','SYSTEM_DERIVED')
    OR source_id IS NOT NULL
  );

-- Prevent obviously contradictory project lifecycle pairs at rest.
ALTER TABLE projects
  ADD CONSTRAINT projects_stage_status_consistency_chk
  CHECK (
    (current_stage = 'DRAFT' AND status = 'DRAFT') OR
    (current_stage IN ('ANALYZING','ANALYSIS_REVIEW','STRUCTURING','STRUCTURE_REVIEW',
      'RESOLVING_RESOURCES','RESOURCES_REVIEW','ART_DIRECTING','ART_DIRECTION_REVIEW',
      'GENERATING','GENERATED','VERIFYING','VERIFICATION_REVIEW') AND status = 'ACTIVE') OR
    (current_stage = 'APPROVED' AND status = 'APPROVED') OR
    (current_stage = 'FINAL' AND status = 'FINAL') OR
    (current_stage = 'ARCHIVED' AND status = 'ARCHIVED')
  );

CREATE TABLE analysis_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE TABLE structure_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE TABLE resource_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE TABLE art_direction_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE TABLE verification_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

COMMIT;
