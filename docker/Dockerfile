# This image exists only to run the suite. mobile ships through Expo and never
# deploys a container, so there is no production stage: what gets pinned here is
# the environment the tests run in, which is the part that used to depend on
# whose machine was running them.
#
# The version is mirrored in .bun-version, which is what the CI reads for lint.
FROM oven/bun:1.4.0 AS test
WORKDIR /app

# Dependencies before the source so the layer cache survives any change under
# app/ or src/.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Nothing here needs root, and the image already ships a uid 1000.
RUN chown -R bun:bun /app
USER bun

CMD ["bun", "run", "test:ci"]
