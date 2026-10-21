# ScoutRoom — 3 comandos: make setup && make data && make dev
PY := pipeline/.venv/bin/python

.PHONY: setup data dev test build check

setup:
	cd pipeline && (command -v uv >/dev/null && uv venv -q .venv && uv pip install -q --python .venv/bin/python -e '.[dev]' \
	  || (python3 -m venv .venv && .venv/bin/pip install -q -e '.[dev]'))
	cd web && npm install

data:
	$(PY) -m scoutroom all

dev:
	cd web && npm run dev

test:
	$(PY) -m pytest -q pipeline/tests
	cd web && npx tsc -b --noEmit && npx eslint . && npx vitest run

build:
	cd web && npm run build

check:
	cd web && node scripts/a11y-and-screens.mjs http://localhost:5173
