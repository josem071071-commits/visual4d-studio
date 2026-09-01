BEGIN;

ALTER TABLE idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_actor_user_id_fkey;

ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES users(id)
  DEFERRABLE INITIALLY DEFERRED;

COMMIT;
