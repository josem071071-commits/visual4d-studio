BEGIN;
DROP INDEX IF EXISTS idempotency_keys_created_at_idx;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_final_design_same_project_fk;
ALTER TABLE projects ADD CONSTRAINT projects_final_design_fk FOREIGN KEY (final_design_version_id) REFERENCES design_versions(id);
ALTER TABLE verification_versions DROP CONSTRAINT IF EXISTS verification_design_same_project_fk;
ALTER TABLE verification_versions ADD CONSTRAINT verification_design_fk FOREIGN KEY (design_version_id) REFERENCES design_versions(id);
ALTER TABLE design_versions DROP CONSTRAINT IF EXISTS design_versions_project_id_id_uniq;
COMMIT;
