#!/usr/bin/env bash
set -euo pipefail

echo "Running linter and code formatting checks for mobile..."
bun run lint
