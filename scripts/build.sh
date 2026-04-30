#!/bin/sh
set -e

cd "$(dirname "$0")/.."

echo "Limpando a pasta dist..."
rm -rf ./dist/*

echo "Compilando Typescript..."
./node_modules/.bin/tsc -p tsconfig.build.json --skipLibCheck
./node_modules/.bin/tsc-alias
