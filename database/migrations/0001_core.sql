BEGIN;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE institutions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED')),
  active_identity_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, id)
);

CREATE TABLE identity_versions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (institution_id, version_number),
  UNIQUE (institution_id, id)
);

ALTER TABLE institutions
  ADD CONSTRAINT institutions_active_identity_same_institution_fk
  FOREIGN KEY (id, active_identity_version_id)
  REFERENCES identity_versions(institution_id, id);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'LOGO','BANNER','PHOTO_DOCUMENTARY','PHOTO_INSTITUTIONAL','GENERATED_IMAGE',
    'ILLUSTRATION','DECORATIVE','ICON','BACKGROUND','SOURCE_DOCUMENT','REFERENCE_DESIGN'
  )),
  name TEXT NOT NULL,
  is_master BOOLEAN NOT NULL DEFAULT false,
  generative_edit_allowed BOOLEAN NOT NULL DEFAULT false,
  current_version_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED','REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (is_master AND generative_edit_allowed)),
  UNIQUE (institution_id, id),
  FOREIGN KEY (owner_user_id, institution_id)
    REFERENCES institutions(owner_user_id, id)
);

CREATE TABLE asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  checksum_sha256 CHAR(64) NOT NULL CHECK (checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED','REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, version_number),
  UNIQUE (asset_id, id)
);

ALTER TABLE assets
  ADD CONSTRAINT assets_current_version_same_asset_fk
  FOREIGN KEY (id, current_version_id)
  REFERENCES asset_versions(asset_id, id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  identity_version_id TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN (
    'FLYER','CAROUSEL','BANNER','COVER','INFOGRAPHIC','DOCUMENT'
  )),
  title TEXT NOT NULL,
  objective TEXT,
  audience TEXT,
  format_width INTEGER NOT NULL CHECK (format_width > 0),
  format_height INTEGER NOT NULL CHECK (format_height > 0),
  orientation TEXT NOT NULL CHECK (orientation IN ('PORTRAIT','LANDSCAPE')),
  current_stage TEXT NOT NULL CHECK (current_stage IN (
    'DRAFT','ANALYZING','ANALYSIS_REVIEW','STRUCTURING','STRUCTURE_REVIEW',
    'RESOLVING_RESOURCES','RESOURCES_REVIEW','ART_DIRECTING','ART_DIRECTION_REVIEW',
    'GENERATING','GENERATED','VERIFYING','VERIFICATION_REVIEW','APPROVED','FINAL','ARCHIVED'
  )),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','APPROVED','FINAL','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_user_id, institution_id)
    REFERENCES institutions(owner_user_id, id),
  FOREIGN KEY (institution_id, identity_version_id)
    REFERENCES identity_versions(institution_id, id)
);

CREATE TABLE approvals (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage TEXT NOT NULL CHECK (stage IN (
    'DRAFT','ANALYZING','ANALYSIS_REVIEW','STRUCTURING','STRUCTURE_REVIEW',
    'RESOLVING_RESOURCES','RESOURCES_REVIEW','ART_DIRECTING','ART_DIRECTION_REVIEW',
    'GENERATING','GENERATED','VERIFYING','VERIFICATION_REVIEW','APPROVED','FINAL','ARCHIVED'
  )),
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'ANALYSIS','STRUCTURE','RESOURCES','ART_DIRECTION','VERIFICATION','DESIGN'
  )),
  artifact_version_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED','REVISION_REQUESTED')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, artifact_type, artifact_version_id, decision)
);

CREATE TABLE provenance_records (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  element_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'USER_INPUT','SOURCE_DOCUMENT','MASTER_ASSET','DOCUMENTARY_ASSET','INSTITUTIONAL_ASSET',
    'GENERATED_ASSET','APPROVED_STRUCTURE','SYSTEM_DERIVED'
  )),
  source_id TEXT,
  generated_by_ai BOOLEAN NOT NULL,
  documentary BOOLEAN NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (generated_by_ai AND documentary)),
  CHECK (NOT (source_type = 'MASTER_ASSET' AND generated_by_ai)),
  CHECK (NOT (source_type = 'DOCUMENTARY_ASSET' AND generated_by_ai)),
  UNIQUE (project_id, element_id)
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  institution_id TEXT REFERENCES institutions(id),
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
