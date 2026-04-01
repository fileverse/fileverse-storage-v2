#!/bin/bash
# Reads scripts/contract-meta.json and prints the base64-encoded value
# for use as the x-contract-meta request header.
#
# Usage:
#   ./scripts/encode-contract-meta.sh

set -e

INPUT="scripts/contract-meta.json"

if [ ! -f "$INPUT" ]; then
  echo "Error: $INPUT not found. Run ./scripts/gen-contract-meta.sh first."
  exit 1
fi

# Compact the JSON (strip whitespace) then base64-encode
ENCODED=$(python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), separators=(',',':')), end='')" < "$INPUT" | base64)

echo "$ENCODED"
