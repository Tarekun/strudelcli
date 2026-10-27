#!/usr/bin/env bash
# installs the toolkit's dependencies and links strudelcli onto the PATH
#
#   ./install.sh [--bin <dir>]    link into <dir> (default ~/.local/bin)
#
# every step is idempotent: run it again after changing package.json or python/pyproject.toml
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

bin="$HOME/.local/bin"
if [[ "${1:-}" == --bin ]]; then bin="$(realpath -m "$2")"; fi
cd "$here"

echo "== node packages"
npm install
echo "== chromium for headless rendering"
npx playwright install chromium
if [[ ! -d .venv ]]; then
  echo "== python environment"
  python3 -m venv .venv
fi
echo "== python packages"
# pip through python: a moved venv keeps stale shebangs in its scripts
# editable, so changes to python/ need no reinstall
.venv/bin/python -m pip install -q -e python

echo "== link $bin/strudelcli"
mkdir -p "$bin"
chmod +x bin/strudelcli.mjs
ln -sfn "$here/bin/strudelcli.mjs" "$bin/strudelcli"
case ":$PATH:" in
  *":$bin:"*) ;;
  *) echo "$bin is not on your PATH: add it to use strudelcli" ;;
esac

# tools some commands shell out to
command -v ffmpeg >/dev/null || echo "missing ffmpeg: needed by master, review and the dj checks"
command -v pw-cat >/dev/null || echo "missing pw-cat: needed by dj playback (pipewire-bin)"
echo "done: try strudelcli help"
