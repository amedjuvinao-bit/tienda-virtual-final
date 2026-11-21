#!/usr/bin/env bash
# Destructive only to the disposable Docker resources created by this script.
# Uses no .env from the project, cloud account, production DB or real customer.
set -Eeuo pipefail
image="${1:-tienda-backend:ci}"
test_run="store-deploy-$(date +%s)-$$"
source_db="${test_run}-source"
restore_db="${test_run}-restore"
api="${test_run}-api"
volume="${test_run}-data"
temp="$(mktemp -d)"

cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs "$api" 2>/dev/null | tail -60 || true; fi
  docker rm -f -v "$api" "$source_db" "$restore_db" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  docker network rm "$test_run" >/dev/null 2>&1 || true
  rm -rf "$temp"
  exit "$result"
}
trap cleanup EXIT

docker network create "$test_run" >/dev/null
docker volume create "$volume" >/dev/null
for db in "$source_db" "$restore_db"; do
  docker run --detach --name "$db" --network "$test_run" mongo:8.0 \
    --replSet rs0 --bind_ip_all --wiredTigerCacheSizeGB 0.25 >/dev/null
  ready=false
  for attempt in $(seq 1 60); do
    if docker exec "$db" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true
  docker exec "$db" mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'$db:27017'}]})" >/dev/null
  ready=false
  for attempt in $(seq 1 60); do
    if docker exec "$db" mongosh --quiet --eval 'if(!db.hello().isWritablePrimary)quit(1)' >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true
done

node - "$source_db" "$restore_db" > "$temp/runtime.env" <<'NODE'
const { randomBytes } = require('node:crypto');
const [source, restore] = process.argv.slice(2);
const values = {
  NODE_ENV: 'production', PORT: '10000',
  MONGO_URI: `mongodb://${source}:27017/ci_store?replicaSet=rs0`,
  STAGING_MONGODB_URI: `mongodb://${restore}:27017/restore_target?replicaSet=rs0`,
  FRONTEND_URL: 'https://store.example.com', BACKEND_URL: 'https://api.example.com',
  BACKUP_DB_NAME: 'ci_store', BACKUP_DIRECTORY: '/var/data/backups',
  BACKUP_PANEL_SINGLE_INSTANCE: 'true',
  // CI has no external writers, and its mock collection is created below.
};
for (const name of ['JWT_SECRET', 'CART_ACCESS_SECRET', 'ORDER_PAYMENT_ACCESS_SECRET',
  'BILLING_ENCRYPTION_KEY', 'INTEGRATIONS_ENCRYPTION_KEY', 'MAIL_ENCRYPTION_KEY',
  'ADMIN_2FA_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY']) values[name] = randomBytes(32).toString('hex');
for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
NODE

docker exec "$source_db" mongosh --quiet --eval \
  "db.getSiblingDB('ci_store').deployment_probe.insertOne({_id:'deployment-smoke',synthetic:true})" >/dev/null
docker run --detach --name "$api" --network "$test_run" \
  --env-file "$temp/runtime.env" --mount "source=$volume,target=/var/data" \
  -p 127.0.0.1::10000 "$image" >/dev/null
url="http://$(docker port "$api" 10000/tcp)"
wait_health() {
  for attempt in $(seq 1 90); do
    if curl --fail --silent --max-time 4 "$url/healthz" > "$temp/health.json"; then
      test "$(cat "$temp/health.json")" = '{"ok":true}'
      return
    fi
    sleep 1
  done
  return 1
}
wait_health
curl --fail --silent --max-time 10 "$url/api/products" >/dev/null
# Inspect the running application, rather than the root bootstrap or exec user.
docker exec "$api" node -e '
const fs = require("node:fs"); const assert = require("node:assert/strict");
const pid = fs.readdirSync("/proc").find(p => /^\d+$/.test(p) && (() => {
  try {
    const args = fs.readFileSync(`/proc/${p}/cmdline`, "utf8").split("\0");
    return require("node:path").basename(args[0]) === "node" && args[1] === "index.js";
  } catch { return false; }
})());
assert.ok(pid, "application process exists");
assert.match(fs.readFileSync(`/proc/${pid}/status`, "utf8"), /^Uid:\s+1000\s+1000\s+1000\s+1000$/m);
for (const file of ["/app/backend/.env", "/app/.env", "/app/backend/backups", "/app/.git", "/var/data/uploads/index.js"]) assert.equal(fs.existsSync(file), false);
for (const file of ["/app/shared/tiktokSelection.cjs", "/usr/local/bin/mongodump", "/usr/local/bin/mongorestore"]) assert.ok(fs.existsSync(file));
'

# Backups run offline: stop the only writer before dumping and restoring.
docker stop --time 120 "$api" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$api")" = 0
docker run --rm --network "$test_run" --env-file "$temp/runtime.env" \
  --mount "source=$volume,target=/var/data" "$image" node scripts/backupAtlasFree.js
docker start "$api" >/dev/null
wait_health
docker exec "$api" node -e '
const fs = require("node:fs"); const assert = require("node:assert/strict");
const dir = "/var/data/backups";
const records = fs.readdirSync(dir).filter(f => /^backup-[a-f0-9]{24}\.json$/.test(f));
assert.equal(records.length, 1);
assert.equal(JSON.parse(fs.readFileSync(`${dir}/${records[0]}`, "utf8")).status, "verificado");
'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "$url/backups/")" = 404
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "$url/uploads/.backup-maintenance.json")" = 404
# Simulate the persisted maintenance gate after an interrupted backup. The
# business API must pause while the infrastructure probe remains healthy.
docker exec --user node "$api" node -e '
require("node:fs").writeFileSync("/var/data/backups/.backup-maintenance.json", JSON.stringify({id:"111111111111111111111111",kind:"database"}));
'
docker restart --time 120 "$api" >/dev/null
wait_health
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "$url/api/products")" = 503
docker exec --user node "$api" node -e 'require("node:fs").unlinkSync("/var/data/backups/.backup-maintenance.json")'
docker restart --time 120 "$api" >/dev/null
wait_health
curl --fail --silent --max-time 10 "$url/api/products" >/dev/null
docker stop --time 120 "$source_db" >/dev/null
test "$(curl --silent --max-time 10 --output "$temp/offline.json" --write-out '%{http_code}' "$url/healthz")" = 503
test "$(cat "$temp/offline.json")" = '{"ok":false}'
docker start "$source_db" >/dev/null
wait_health
docker stop --time 120 "$api" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$api")" = 0
echo 'OK: arranque en producción, usuario sin privilegios, rutas, copia cifrada y restaurada, persistencia, mantenimiento, caída de MongoDB y cierre ordenado.'
