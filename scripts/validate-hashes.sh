#!/usr/bin/env bash
# validate-hashes.sh — Verify or update content hashes against MANIFEST.yaml
# Zero dependencies beyond bash, shasum or sha256sum, and awk.
#
# Adapted from skill-provenance/validate.sh (CC-BY 4.0 / Apache 2.0 dual).
# Provides tamper detection and reproducibility for the canonical content
# set declared in MANIFEST.yaml. Opt-in — CI only runs this when
# MANIFEST.yaml is present at the repo root.
#
# Usage:
#   ./scripts/validate-hashes.sh           Verify hashes (default)
#   ./scripts/validate-hashes.sh --update  Recompute and write hashes
#   ./scripts/validate-hashes.sh --help    Show usage
#
# Exit codes:
#   0 = all files present and hashes match (verify) or updated (update)
#   1 = mismatches or missing files found
#   2 = MANIFEST.yaml not found

export LC_ALL=C
export LANG=C

set -euo pipefail

MODE="verify"
BUNDLE_DIR=""
UPDATES_FILE=""
TEMP_MANIFEST=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/validate-hashes.sh           Verify hashes (default)
  ./scripts/validate-hashes.sh --update  Recompute and write hashes
  ./scripts/validate-hashes.sh --help    Show usage

The bundle root is the directory containing MANIFEST.yaml. Run from
the repository root or pass a directory as the first non-flag argument.
EOF
}

cleanup() {
  if [ -n "$UPDATES_FILE" ] && [ -f "$UPDATES_FILE" ]; then
    rm -f "$UPDATES_FILE"
  fi
  if [ -n "$TEMP_MANIFEST" ] && [ -f "$TEMP_MANIFEST" ]; then
    rm -f "$TEMP_MANIFEST"
  fi
}

trap cleanup EXIT

for arg in "$@"; do
  case "$arg" in
    --update)
      MODE="update"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -z "$BUNDLE_DIR" ]; then
        BUNDLE_DIR="$arg"
      else
        echo "ERROR: unexpected argument: $arg"
        usage
        exit 1
      fi
      ;;
  esac
done

if [ -z "$BUNDLE_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  BUNDLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

MANIFEST="$BUNDLE_DIR/MANIFEST.yaml"

if command -v shasum >/dev/null 2>&1; then
  sha256_hash() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256_hash() { sha256sum "$1" | awk '{print $1}'; }
else
  echo "ERROR: neither shasum nor sha256sum found"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: MANIFEST.yaml not found in $BUNDLE_DIR"
  exit 2
fi

errors=0
checked=0
skipped=0
updated=0

if [ "$MODE" = "update" ]; then
  UPDATES_FILE=$(mktemp "${TMPDIR:-/tmp}/kac-hash-updates.XXXXXX")
  TEMP_MANIFEST=$(mktemp "${TMPDIR:-/tmp}/kac-hash-manifest.XXXXXX")
fi

declare -a paths=()
declare -a expected_hashes=()
current_path=""
current_hash=""

while IFS= read -r line; do
  if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*path:[[:space:]]*(.+)$ ]]; then
    if [ -n "$current_path" ]; then
      paths+=("$current_path")
      expected_hashes+=("$current_hash")
    fi
    current_path="${BASH_REMATCH[1]}"
    current_hash=""
  fi
  if [[ "$line" =~ ^[[:space:]]*hash:[[:space:]]*sha256:([a-f0-9]+)$ ]]; then
    current_hash="${BASH_REMATCH[1]}"
  fi
done < "$MANIFEST"
if [ -n "$current_path" ]; then
  paths+=("$current_path")
  expected_hashes+=("$current_hash")
fi

for i in "${!paths[@]}"; do
  path="${paths[$i]}"
  expected="${expected_hashes[$i]}"
  filepath="$BUNDLE_DIR/$path"

  if [ -z "$expected" ]; then
    echo "SKIP     $path (no hash in manifest)"
    skipped=$((skipped + 1))
    continue
  fi

  if [ ! -f "$filepath" ]; then
    echo "MISSING  $path"
    errors=$((errors + 1))
    checked=$((checked + 1))
    continue
  fi

  actual=$(sha256_hash "$filepath")

  if [ "$MODE" = "update" ]; then
    if [ "$actual" != "$expected" ]; then
      printf '%s\t%s\n' "$path" "$actual" >> "$UPDATES_FILE"
      echo "UPDATED  $path"
      updated=$((updated + 1))
    else
      echo "OK       $path"
    fi
  else
    if [ "$actual" = "$expected" ]; then
      echo "OK       $path"
    else
      echo "MISMATCH $path"
      echo "  expected: $expected"
      echo "  actual:   $actual"
      errors=$((errors + 1))
    fi
  fi
  checked=$((checked + 1))
done

if [ "$MODE" = "update" ] && [ "$updated" -gt 0 ]; then
  awk -v updates_file="$UPDATES_FILE" '
    BEGIN {
      while ((getline line < updates_file) > 0) {
        split(line, fields, "\t")
        replacements[fields[1]] = fields[2]
      }
      close(updates_file)
      current_path = ""
    }
    {
      line = $0
      if (line ~ /^[[:space:]]*-[[:space:]]*path:[[:space:]]*/) {
        current_path = line
        sub(/^[[:space:]]*-[[:space:]]*path:[[:space:]]*/, "", current_path)
      }
      if (current_path != "" &&
          (current_path in replacements) &&
          line ~ /^[[:space:]]*hash:[[:space:]]*sha256:[a-f0-9]+[[:space:]]*$/) {
        sub(/sha256:[a-f0-9]+/, "sha256:" replacements[current_path], line)
        current_path = ""
      }
      print line
    }
  ' "$MANIFEST" > "$TEMP_MANIFEST"
  mv "$TEMP_MANIFEST" "$MANIFEST"
  TEMP_MANIFEST=""
fi

echo ""
if [ "$MODE" = "update" ]; then
  echo "Checked $checked files, skipped $skipped, updated $updated"
  if [ "$errors" -gt 0 ]; then
    echo "Missing files: $errors"
    exit 1
  fi
  if [ "$updated" -gt 0 ]; then
    echo "MANIFEST.yaml updated."
  else
    echo "All hashes already current."
  fi
else
  echo "Checked $checked files, skipped $skipped, errors $errors"
  if [ "$errors" -gt 0 ]; then
    exit 1
  fi
  echo "All hashes verified."
fi
