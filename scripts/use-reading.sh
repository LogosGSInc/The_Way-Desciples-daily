#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <entry-id-json-filename>"
  echo "Example: $0 5786-01-29-bo-7.json"
  exit 1
fi

SRC="content/daily/$1"
DST="app/app/the-way-reader/public/content/daily/5786-01-29-bo-7.json"

if [ ! -f "$SRC" ]; then
  echo "Source not found: $SRC"
  exit 1
fi

cp "$SRC" "$DST"
echo "Now serving: $SRC"
