#!/usr/bin/env bash
set -euo pipefail

base_url=${1:-http://127.0.0.1:3000}
base_url=${base_url%/}
response_file=$(mktemp)
item_id=''

cleanup() {
  if [[ -n "$item_id" ]]; then
    if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
        --request DELETE --output /dev/null "$base_url/items/$item_id"; then
      echo "Check whether smoke-test item $item_id still needs cleanup." >&2
    fi
  fi
  rm -f -- "$response_file"
}
trap cleanup EXIT

check_request() {
  local expected=$1 method=$2 path=$3 status
  shift 3
  status=$(curl --silent --show-error --connect-timeout 5 --max-time 15 \
    --request "$method" --output "$response_file" --write-out '%{http_code}' \
    "$@" "$base_url$path")
  printf '%s %s -> %s\n' "$method" "$path" "$status"
  if [[ "$status" != "$expected" ]]; then
    printf 'Expected HTTP %s\n' "$expected" >&2
    cat "$response_file" >&2
    printf '\n' >&2
    return 1
  fi
}

check_request 200 GET /health
check_request 200 GET /health/db
check_request 201 POST /items --header 'Content-Type: application/json' \
  --data '{"name":"Smoke-test item","category":"Testing","quantity":1,"item_condition":"good"}'
item_id=$(node -e '
  const { readFileSync } = require("node:fs");
  const { id } = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error("Invalid created item ID");
  console.log(id);
' "$response_file")

check_request 200 GET /items
node -e '
  const { readFileSync } = require("node:fs");
  const [file, id] = process.argv.slice(1);
  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!rows.some(item => item.id === Number(id) && item.name === "Smoke-test item")) {
    throw new Error("Created item missing from inventory");
  }
' "$response_file" "$item_id"

check_request 200 PUT "/items/$item_id" --header 'Content-Type: application/json' \
  --data '{"name":"Smoke-test item","category":"Testing","quantity":2,"item_condition":"maintenance"}'
node -e '
  const { readFileSync } = require("node:fs");
  const [file, id] = process.argv.slice(1);
  const item = JSON.parse(readFileSync(file, "utf8"));
  if (item.id !== Number(id) || item.quantity !== 2 || item.item_condition !== "maintenance") {
    throw new Error("Updated item does not match the request");
  }
' "$response_file" "$item_id"

check_request 204 DELETE "/items/$item_id"
item_id=''
echo "Smoke test passed."
