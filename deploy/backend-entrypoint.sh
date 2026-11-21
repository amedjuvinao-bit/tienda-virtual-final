#!/bin/sh
set -eu
umask 077

if [ "$(id -u)" = 0 ]; then
  install -d -o node -g node -m 0700 /var/data/backups
  install -d -o node -g node -m 0755 /var/data/uploads
  # Existing files on the disk always win over the legacy image contents.
  cp -an /opt/store-legacy-uploads/. /var/data/uploads/
  chown -R node:node /var/data/uploads
  exec gosu node "$@"
fi

exec "$@"
