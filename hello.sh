#!/usr/bin/env bash
set -euo pipefail

# Usage: ./hello.sh [name]   (prompts if name omitted)

if [[ -n "${1:-}" ]]; then
    name="$1"
else
    printf 'Enter your name: '
    read -r name
fi

if [[ -z "$name" ]]; then
    printf 'Error: name must not be empty\n' >&2
    exit 1
fi

greeting="Hello, ${name}!"

printf '%s\n' "$greeting"
