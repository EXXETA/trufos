#!/usr/bin/env bash
#
# Decides whether a Dependabot patch PR may be auto-merged and, if so, enables
# GitHub auto-merge for it. Used by .github/workflows/dependabot-auto-merge.yml.
#
# A version is only eligible once it has been published on npm for at least
# MIN_AGE_DAYS days (supply-chain safety: freshly published versions may be
# yanked or compromised — see the "shai-hulud" npm attacks). For grouped
# updates the newest (youngest) version in the group governs the gate.
#
# Required environment:
#   GH_TOKEN              token for the gh CLI
#   REPO                  owner/name of the repository
#   EVENT_NAME            triggering event (pull_request_target | schedule)
#   MIN_AGE_DAYS          minimum publish age in days
#   CANDIDATE_LABEL       label marking re-evaluatable patch PRs
# For pull_request_target:
#   PR_URL                the pull request URL
#   UPDATE_TYPE           dependabot/fetch-metadata update-type output
#   UPDATED_DEPENDENCIES  dependabot/fetch-metadata updated-dependencies-json

set -euo pipefail

MIN_AGE_HOURS=$((MIN_AGE_DAYS * 24))

# Age in whole hours since a package version was published on npm.
# Prints -1 when the publish time is unknown.
publish_age_hours() {
  local pkg="$1" ver="$2" published now
  published=$(curl -sf "https://registry.npmjs.org/$(printf '%s' "$pkg" | sed 's:/:%2f:g')" |
    jq -r --arg v "$ver" '.time[$v] // empty') || published=""
  if [ -z "$published" ]; then
    echo "-1"
    return
  fi
  published=$(date -u -d "$published" +%s)
  now=$(date -u +%s)
  echo $(((now - published) / 3600))
}

# Reads "<pkg> <version>" pairs on stdin. Returns 0 only if every version was
# published at least MIN_AGE_HOURS ago (the youngest one governs).
newest_old_enough() {
  local pkg ver age min_age=999999 saw=0
  while read -r pkg ver; do
    [ -z "$pkg" ] && continue
    saw=1
    age=$(publish_age_hours "$pkg" "$ver")
    echo "  $pkg@$ver -> ${age}h old (need >= ${MIN_AGE_HOURS}h)"
    if [ "$age" -lt 0 ]; then
      echo "  publish time for $pkg@$ver unknown; not merging yet"
      return 1
    fi
    if [ "$age" -lt "$min_age" ]; then min_age=$age; fi
  done
  [ "$saw" -eq 1 ] && [ "$min_age" -ge "$MIN_AGE_HOURS" ]
}

enable_auto_merge() {
  echo "Enabling auto-merge for $1"
  gh pr merge --auto --squash "$1"
}

if [ "$EVENT_NAME" = "pull_request_target" ]; then
  if [ "$UPDATE_TYPE" != "version-update:semver-patch" ]; then
    echo "Update type '$UPDATE_TYPE' is not a patch; skipping auto-merge."
    exit 0
  fi
  pairs=$(printf '%s' "$UPDATED_DEPENDENCIES" | jq -r '.[] | "\(.dependencyName) \(.newVersion)"')
  echo "Checking publish age for:"
  printf '%s\n' "$pairs"
  if printf '%s\n' "$pairs" | newest_old_enough; then
    enable_auto_merge "$PR_URL"
  else
    echo "Newest version younger than ${MIN_AGE_DAYS}d; will re-check on the next scheduled run."
  fi
  exit 0
fi

# Scheduled re-evaluation of patch PRs that were still too young earlier.
echo "Re-evaluating open patch PRs labelled '$CANDIDATE_LABEL'..."
gh pr list --repo "$REPO" --state open --label "$CANDIDATE_LABEL" \
  --json url,title --jq '.[] | [.url, .title] | @tsv' |
  while IFS=$'\t' read -r url title; do
    # Single-package Dependabot titles: "...Bump <pkg> from <a> to <b>".
    if [[ "$title" =~ Bump\ ([^[:space:]]+)\ from\ [^[:space:]]+\ to\ ([^[:space:]]+) ]]; then
      pkg="${BASH_REMATCH[1]}"
      ver="${BASH_REMATCH[2]}"
      echo "PR $url -> $pkg@$ver"
      if printf '%s %s\n' "$pkg" "$ver" | newest_old_enough; then
        enable_auto_merge "$url"
      fi
    else
      echo "PR $url: not a single-package title; handled on its next sync event."
    fi
  done
