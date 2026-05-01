#!/usr/bin/env bash
# validate-setup.sh — Validates nestjs-dynamic-query-builder setup in a NestJS project.
# Usage: bash validate-setup.sh [project-root]
# Exit codes: 0 = all checks pass, 1 = one or more checks failed

set -euo pipefail

PROJECT_ROOT="${1:-.}"
ERRORS=0

# Colors (fallback to plain if not a terminal)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  NC='\033[0m'
else
  GREEN='' RED='' YELLOW='' NC=''
fi

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; echo -e "  ${YELLOW}→ $2${NC}"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "Validating nestjs-dynamic-query-builder setup in: $PROJECT_ROOT"
echo "---"

# 1. Check package is installed
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '@multitechbr/nestjs-dynamic-query-builder' "$PROJECT_ROOT/package.json"; then
    pass "Package @multitechbr/nestjs-dynamic-query-builder found in package.json"
  else
    fail "Package not found in package.json" \
      "Run: npm install @multitechbr/nestjs-dynamic-query-builder"
  fi
else
  fail "No package.json found in $PROJECT_ROOT" \
    "Are you running this from the project root?"
fi

# 2. Check .npmrc exists
if [ -f "$PROJECT_ROOT/.npmrc" ]; then
  if grep -q '@multitechbr:registry' "$PROJECT_ROOT/.npmrc"; then
    pass ".npmrc has @multitechbr registry configured"
  else
    fail ".npmrc missing @multitechbr registry" \
      "Add: @multitechbr:registry=https://gitlab.com/api/v4/packages/npm"
  fi
else
  warn "No .npmrc found — package may not install from GitLab registry"
fi

# 3. Check main.ts for query parser
MAIN_FILE=""
for f in "$PROJECT_ROOT/src/main.ts" "$PROJECT_ROOT/main.ts"; do
  if [ -f "$f" ]; then MAIN_FILE="$f"; break; fi
done

if [ -n "$MAIN_FILE" ]; then
  if grep -q "query parser" "$MAIN_FILE" && grep -q "extended" "$MAIN_FILE"; then
    pass "Extended query parser found in $(basename "$MAIN_FILE")"
  else
    fail "Missing extended query parser in $(basename "$MAIN_FILE")" \
      "Add: app.set('query parser', 'extended');"
  fi

  if grep -q "enableImplicitConversion" "$MAIN_FILE"; then
    pass "enableImplicitConversion found in $(basename "$MAIN_FILE")"
  else
    fail "Missing enableImplicitConversion in $(basename "$MAIN_FILE")" \
      "Add ValidationPipe with: transformOptions: { enableImplicitConversion: true }"
  fi

  if grep -q "ValidationPipe" "$MAIN_FILE"; then
    pass "ValidationPipe found in $(basename "$MAIN_FILE")"
  else
    fail "Missing ValidationPipe in $(basename "$MAIN_FILE")" \
      "Add: app.useGlobalPipes(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }));"
  fi
else
  warn "Could not find main.ts — skipping bootstrap checks"
fi

# 4. Check AppModule for DynamicQueryBuilderModule
APP_MODULE=""
for f in "$PROJECT_ROOT/src/app.module.ts" "$PROJECT_ROOT/app.module.ts"; do
  if [ -f "$f" ]; then APP_MODULE="$f"; break; fi
done

if [ -n "$APP_MODULE" ]; then
  if grep -q "DynamicQueryBuilderModule" "$APP_MODULE"; then
    pass "DynamicQueryBuilderModule registered in $(basename "$APP_MODULE")"
  else
    fail "DynamicQueryBuilderModule not found in $(basename "$APP_MODULE")" \
      "Add: DynamicQueryBuilderModule.forRoot() to AppModule imports"
  fi
else
  warn "Could not find app.module.ts — skipping module check"
fi

# 5. Check TypeORM is installed
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '"typeorm"' "$PROJECT_ROOT/package.json"; then
    pass "TypeORM found in package.json"
  else
    fail "TypeORM not found in package.json" \
      "Run: npm install typeorm @nestjs/typeorm"
  fi
fi

echo "---"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All checks passed.${NC}"
  exit 0
else
  echo -e "${RED}$ERRORS check(s) failed.${NC} Fix the issues above and re-run."
  exit 1
fi
