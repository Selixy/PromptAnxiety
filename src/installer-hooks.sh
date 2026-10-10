#!/usr/bin/env bash
# À lancer une fois après un clone : active les hooks versionnés de .githooks/.
cd "$(dirname "$(readlink -f "$0")")/.." && git config core.hooksPath .githooks && echo "hooks activés (.githooks/)"
