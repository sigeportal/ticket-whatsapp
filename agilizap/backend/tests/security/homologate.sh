#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
compose=(docker compose -f tests/security/compose.yml)
# Project name and tmpfs belong exclusively to this test, never the application Compose.
cleanup() { "${compose[@]}" down; }
trap cleanup EXIT
"${compose[@]}" up -d --wait
"${compose[@]}" run --rm runner
docker exec -i ticket-security-homolog-postgres-1 sh < tests/security/backup.sh
