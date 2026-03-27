## EcoWatt

This repo was exported from Caffeine and contains:

- `src/frontend`: React + Vite app
- `src/backend`: Motoko canister (Internet Computer)

## Run (frontend only)

Prereqs: Node.js + `pnpm`.

From the repo root:

```bash
pnpm install
pnpm dev
```

If `pnpm dev` still doesn’t find the frontend package for some reason, run it directly:

```bash
pnpm -C src/frontend dev
```

Note: if you see a Vite warning about `baseline-browser-mapping` being out of date, it’s safe to ignore. To remove the warning, run `pnpm install` after updating deps (or run `pnpm -C src/frontend add -D baseline-browser-mapping@latest`).

If the app complains about missing `CANISTER_ID_BACKEND`, you can run with a mock backend:

- PowerShell:
  - `$env:VITE_USE_MOCK="true"; pnpm dev`
- bash:
  - `VITE_USE_MOCK=true pnpm dev`

If you see `Error: spawn EPERM` while starting/building (Vite/esbuild), try running in Docker (below) or check Windows security/AV policies that can block Node from spawning binaries.

## Run (full local canisters)

Prereqs:

- `icp` CLI installed and on your `PATH`
- A bash shell on Windows (WSL or Git Bash) to run `deploy.sh`

From the repo root:

```bash
bash ./deploy.sh
```

This starts a local `icp` network, creates the `frontend` and `backend` canisters, deploys them, and keeps the process running until you press Ctrl+C.

## Run (Docker)

Prereqs: Docker Desktop.

```bash
docker build -t ecowatt .
docker run --rm -p 8000:8000 -p 8081:8081 -p 6188:6188 ecowatt
```
