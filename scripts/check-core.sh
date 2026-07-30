#!/usr/bin/env bash
set -euo pipefail
pnpm --filter @kawkab/shared-types test
pnpm --filter @kawkab/validation test
pnpm --filter @kawkab/ai-orchestrator test
pnpm --filter @kawkab/simulation-engine test
