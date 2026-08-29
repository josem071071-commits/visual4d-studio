BEGIN;

-- Make design references project-scoped at the database layer, not only in services.
ALTER TABLE design_versions
  ADD CONSTRAINT design_versions_project_id_id_uniq UNIQUE(project_id, id);

ALTER TABLE verification_versions DROP CONSTRAINT IF EXISTS verification_design_fk;
ALTER TABLE verification_versions
  ADD CONSTRAINT verification_design_same_project_fk
  FOREIGN KEY (project_id, design_version_id)
  REFERENCES design_versions(project_id, id);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_final_design_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_final_design_same_project_fk
  FOREIGN KEY (id, final_design_version_id)
  REFERENCES design_versions(project_id, id);

CREATE INDEX idempotency_keys_created_at_idx ON idempotency_keys(created_at);

COMMIT;
