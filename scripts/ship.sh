#!/usr/bin/env sh
# Since 10 Sep 2026 the live site is v2. This forwards to v2/scripts/ship.sh.
# v1 (tag v1.0.0) is kept in the repository and can still be built here with
# `npm run build`, but nothing deploys it any more.
exec sh "$(dirname "$0")/../v2/scripts/ship.sh" "$@"
