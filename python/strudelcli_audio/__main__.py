import importlib
import sys

# imported on demand, so one task's heavy dependencies don't slow down the others
TASKS = ['analyze']

if len(sys.argv) < 2 or sys.argv[1] not in TASKS:
    sys.exit(f'usage: python -m strudelcli_audio {"|".join(TASKS)} [args]')
importlib.import_module(f'{__package__}.{sys.argv[1]}').main(sys.argv[2:])
