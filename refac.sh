#!/usr/bin/env bash
set -uo pipefail

SRC="$1"
SPEC="${SRC%.ts}.spec.ts"

date --rfc-3339=second

echo "*** LINTING SOURCE: $SRC ***"
oxlint "$SRC"; eslint "$SRC"

if [ -f "$SPEC" ]; then
  echo "*** LINTING SPEC: $SPEC ***"
  oxlint "$SPEC"; eslint "$SPEC"

  echo "*** TESTING: $SPEC ***"
  bun test "$SPEC"
else
  echo "No spec found at $SPEC, skipping tests."
fi