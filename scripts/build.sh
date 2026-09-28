#!/bin/bash
# Bouw versienummer op als: jaar.PR-nummer.commit-count[-achtervoegsel]
# Voorbeeld: 2026.46.142 (productie), 2026.56.190-preview (deploy preview)

YEAR=$(date +%Y)
PR=$(git log -1 --merges --pretty=format:'%s' | grep -oE '#[0-9]+' | head -1 | tr -d '#')
COMMITS=$(git rev-list --count HEAD)

# Een preview mag er nooit uitzien als een productieversie: onderin de app en in
# app_version (Make, create-order) moet te zien zijn waar een aanmelding vandaan kwam.
# Op een deploy preview weet Netlify het PR-nummer zeker (REVIEW_ID); de laatste
# merge-commit is op een feature-branch nog die van de vórige PR.
case "${CONTEXT:-lokaal}" in
  production) SUFFIX="" ;;
  deploy-preview) SUFFIX="-preview"; PR="${REVIEW_ID:-$PR}" ;;
  *) SUFFIX="-${CONTEXT:-lokaal}" ;;
esac

VITE_APP_VERSION="${YEAR}.${PR:-0}.${COMMITS}${SUFFIX}" npm run build
