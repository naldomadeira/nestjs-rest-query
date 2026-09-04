#!/bin/sh
# Valida o artefato publicável nos mesmos gates da CI (spec §20).
#
#   - publint: higiene do package.json
#   - arethetypeswrong: resolução de tipos por perfil de módulo
#   - consumer fixtures: instalação isolada do tarball, CJS e ESM
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "==> build"
pnpm build

echo "==> publint"
pnpm dlx publint

echo "==> arethetypeswrong"
pnpm dlx @arethetypeswrong/cli --pack .

echo "==> packing"
TARBALL_NAME=$(npm pack --silent)
TARBALL="$ROOT/$TARBALL_NAME"

for fixture in tests/v3/package/consumer-fixtures/*/; do
  echo "==> consumer fixture: $fixture"
  (
    cd "$fixture"
    rm -rf node_modules package-lock.json
    npm init -y >/dev/null
    npm install "$TARBALL" --silent --no-audit --no-fund
    node index.*js
    rm -rf node_modules package-lock.json package.json
  )
done

rm -f "$TARBALL"
echo "==> package verified"
