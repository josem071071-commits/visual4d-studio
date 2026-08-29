BEGIN;
DROP TABLE IF EXISTS approval_grants;
ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS error_code, DROP COLUMN IF EXISTS status;
ALTER TABLE idempotency_keys ALTER COLUMN result_json SET NOT NULL;
COMMIT;
