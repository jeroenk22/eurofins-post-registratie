#!/bin/bash
# Bouw versienummer op als: jaar.PR-nummer.commit-count
# Voorbeeld: 2026.46.142

YEAR=$(date +%Y)
PR=$(git log -1 --merges --pretty=format:'%s' | grep -oE '#[0-9]+' | head -1 | tr -d '#')
COMMITS=$(git rev-list --count HEAD)

VITE_APP_VERSION="${YEAR}.${PR:-0}.${COMMITS}" npm run build
