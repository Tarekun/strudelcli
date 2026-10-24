#!/usr/bin/env bash
# render a track offline (mix + one stem per instrument) and review it
#
#   ./review.sh <track.strudel.js> [--reference some-track.wav] [render.mjs options]
#
# writes out/<track>/report.md, next to mix.wav and stems/
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

track="$1"
shift
reference=()
render=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reference) reference=(--reference "$(realpath "$2")"); shift 2 ;;
    *) render+=("$1"); shift ;;
  esac
done

name="$(basename "$track")"
name="${name%.strudel.js}"
out="$here/out/${name%.js}"

node "$here/render.mjs" "$track" --stems --out "$out" "${render[@]}"
"$here/.venv/bin/python" -I "$here/analyze.py" "$out" "${reference[@]}"
