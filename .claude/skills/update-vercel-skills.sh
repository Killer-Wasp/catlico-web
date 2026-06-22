#!/usr/bin/env bash
#
# Update the React skills vendored from vercel-labs/agent-skills.
#
# These skills are copied (vendored) into .claude/skills/, not git-submoduled,
# so they don't auto-update. Run this script to re-pull the latest versions.
#
# Usage:  ./.claude/skills/update-vercel-skills.sh
#
set -euo pipefail

REPO="https://github.com/vercel-labs/agent-skills.git"

# Skills we track from that repo. Add a folder name here to start tracking it.
SKILLS=(
  composition-patterns
  react-best-practices
  react-view-transitions
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Cloning $REPO ..."
git clone --depth 1 "$REPO" "$TMP/agent-skills" >/dev/null 2>&1

for skill in "${SKILLS[@]}"; do
  src="$TMP/agent-skills/skills/$skill"
  dst="$SCRIPT_DIR/$skill"
  if [ ! -d "$src" ]; then
    echo "  !! $skill no longer exists upstream — skipping"
    continue
  fi
  rm -rf "$dst"
  cp -R "$src" "$dst"
  echo "  ok  $skill"
done

echo "Done. Review changes with: git diff .claude/skills/"
