#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ORG=iQube-Protocol REPO=metame-convos-ios ./scripts/mobile/bootstrap-convos-ios-fork.sh
#
# Required:
# - gh CLI authenticated
# - git ssh access to GitHub

ORG="${ORG:-}"
REPO="${REPO:-metame-convos-ios}"
UPSTREAM="xmtplabs/convos-ios"

if [[ -z "$ORG" ]]; then
  echo "ERROR: set ORG=<github-org>"
  exit 1
fi

echo "==> Creating fork ${ORG}/${REPO} from ${UPSTREAM} (if needed)"
if ! gh repo view "${ORG}/${REPO}" >/dev/null 2>&1; then
  gh repo fork "${UPSTREAM}" --org "${ORG}" --clone=false
  gh repo rename "${ORG}/convos-ios" "${REPO}"
fi

if [[ -d "${REPO}" ]]; then
  echo "==> Repo directory ${REPO} already exists. Skipping clone."
else
  echo "==> Cloning ${ORG}/${REPO}"
  git clone "git@github.com:${ORG}/${REPO}.git" "${REPO}"
fi

cd "${REPO}"

echo "==> Configuring remotes"
if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream "git@github.com:${UPSTREAM}.git"
fi
git fetch upstream
git fetch origin

echo "==> Creating integration branch metame/runtime-ios"
git checkout -B metame/runtime-ios origin/main

echo "==> Bootstrap complete"
echo "Next steps:"
echo "1. Open Xcode and add MetaMeRuntimeApp target"
echo "2. Add RuntimeDev/RuntimeStaging/RuntimeProd xcconfig files"
echo "3. Commit first target scaffolding PR"

