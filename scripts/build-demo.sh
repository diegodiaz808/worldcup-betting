#!/bin/bash
# Builds the static demo (GitHub Pages) from the snapshot data in public/data.
# API routes can't exist in a static export, so they're moved aside during build.
set -e
cd "$(dirname "$0")/.."

mv app/api /tmp/wc-api-backup
trap 'mv /tmp/wc-api-backup app/api' EXIT

DEMO_EXPORT=1 NEXT_PUBLIC_DEMO=1 NEXT_PUBLIC_BASE_PATH=/worldcup-betting npx next build

touch out/.nojekyll
echo "Demo build listo en out/"
