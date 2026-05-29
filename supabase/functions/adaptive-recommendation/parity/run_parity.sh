#!/usr/bin/env bash
# End-to-end parity runner: generate the Python golden file, transpile the TS
# policy to ESM (via Deno if present, else the frontend's esbuild), then run the
# Node harness that asserts TS == Python on every fixture.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNC_DIR="$(dirname "$HERE")"
REPO_ROOT="$(cd "$FUNC_DIR/../../.." && pwd)"
POLICY_TS="$FUNC_DIR/policy.ts"
GOLDEN="$HERE/golden.json"
FIXTURES="$HERE/fixtures.json"
TMP_JS="$HERE/.policy.bundle.mjs"

echo "[1/3] Generating Python golden file..."
python "$HERE/gen_golden.py"

echo "[2/3] Transpiling policy.ts -> ESM..."
if command -v deno >/dev/null 2>&1; then
  # Prefer running the TS directly under Deno when available.
  echo "  (Deno present; checking policy.ts)"
  deno check "$POLICY_TS"
fi
ESBUILD="$REPO_ROOT/frontend/node_modules/.bin/esbuild"
if [ ! -x "$ESBUILD" ] && [ ! -f "$ESBUILD.cmd" ]; then
  echo "esbuild not found at $ESBUILD" >&2
  exit 3
fi
# esbuild strips the .ts import extension issue by bundling to a single ESM file.
"$ESBUILD" "$POLICY_TS" --bundle --format=esm --platform=node --outfile="$TMP_JS"

echo "[3/3] Running parity harness..."
node "$HERE/run_parity.mjs" "$TMP_JS" "$GOLDEN" "$FIXTURES"
status=$?

rm -f "$TMP_JS"
exit $status
