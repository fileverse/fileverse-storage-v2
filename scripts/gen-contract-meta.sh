#!/bin/bash
# Generates contract-meta.json from comma-separated addresses.
# Edit the version field in the file before running encode-contract-meta.sh.
#
# Usage:
#   ./scripts/gen-contract-meta.sh <comma-separated-addresses>
#
# Example:
#   ./scripts/gen-contract-meta.sh 0xabc,0xdef

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <comma-separated-addresses>"
  exit 1
fi

OUTPUT="scripts/contract-meta.json"

JSON="["
FIRST=true
IFS=',' read -ra ADDR_LIST <<< "$1"
for addr in "${ADDR_LIST[@]}"; do
  addr=$(echo "$addr" | tr -d '[:space:]')
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    JSON+=","
  fi
  JSON+="{\"contractAddress\":\"$addr\",\"version\":\"v2\"}"
done
JSON+="]"

echo "$JSON" | python3 -m json.tool > "$OUTPUT"

echo "Written to $OUTPUT — edit version fields as needed, then run:"
echo "  ./scripts/encode-contract-meta.sh"

