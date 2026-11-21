# syntax=docker/dockerfile:1
# Node 24 LTS, pinned to the verified multi-platform image manifest.
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS base

FROM base AS mongo-tools
# Official Debian 12 x86_64 artifact and SHA-256 from MongoDB's release manifest.
# Render's Docker runtime and this build target use linux/amd64.
RUN test "$(dpkg --print-architecture)" = amd64 \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl --fail --show-error --silent --location --retry 3 \
       https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-100.20.1.tgz \
       -o /tmp/tools.tgz \
    && echo '8f25dcd1d769560fae1b5e724dc0c5eba54f2410dd293a9bab62be055507e521  /tmp/tools.tgz' | sha256sum -c - \
    && mkdir /tools \
    && tar -xzf /tmp/tools.tgz --strip-components=2 -C /tools \
       mongodb-database-tools-debian12-x86_64-100.20.1/bin/mongodump \
       mongodb-database-tools-debian12-x86_64-100.20.1/bin/mongorestore

FROM base AS dependencies
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM base AS runtime
LABEL org.opencontainers.image.source="https://github.com/amedjuvinao-bit/tienda-virtual-final"
ENV NODE_ENV=production PORT=10000 BACKUP_DIRECTORY=/var/data/backups
WORKDIR /app/backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgssapi-krb5-2 tini gosu \
    && rm -rf /var/lib/apt/lists/*
COPY --from=mongo-tools /tools/mongodump /tools/mongorestore /usr/local/bin/
RUN mongodump --version && mongorestore --version
COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY shared/ /app/shared/
COPY --chmod=755 deploy/backend-entrypoint.sh /usr/local/bin/store-entrypoint
# Preserve tracked legacy images; runtime uploads live on the persistent disk.
RUN mv uploads /opt/store-legacy-uploads \
    && ln -s /var/data/uploads uploads
EXPOSE 10000
STOPSIGNAL SIGTERM
# The short root bootstrap fixes mounted-disk ownership, then drops to uid 1000.
# tini forwards signals to backup children as well as the Node application.
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/usr/local/bin/store-entrypoint"]
CMD ["node", "index.js"]
