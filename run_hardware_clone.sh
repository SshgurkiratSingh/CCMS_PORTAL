#!/usr/bin/env bash
# CCMS Hardware Digital Clone Launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "⚡ Launching CCMS Digital Hardware Clone / Simulator"
echo "=========================================================="

python3 "$SCRIPT_DIR/Tools/hardware_clone/hardware_clone.py" "$@"
