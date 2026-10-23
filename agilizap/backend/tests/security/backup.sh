#!/bin/sh
set -eu
pg_dump -U security_test -d security_homolog -Fc -f /tmp/security.dump
createdb -U security_test security_restore
pg_restore -U security_test -d security_restore --exit-on-error /tmp/security.dump
psql -U security_test -d security_restore -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM "Users" WHERE email='legacy@example.invalid' AND "tokenVersion"=10 AND "resetPassword" IS NULL) <> 1 THEN
    RAISE EXCEPTION 'Restored fictitious user differs';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace) <> 73 THEN
    RAISE EXCEPTION 'Restored foreign keys differ';
  END IF;
END $$;
SQL
echo 'PASS pg_dump/pg_restore: fictitious user, revoked credentials and 73 foreign keys restored'
