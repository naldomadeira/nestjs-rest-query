#!/usr/bin/env bash
# validate-setup.sh — Validates nestjs-rest-query setup in a NestJS project.
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

echo "Validating nestjs-rest-query setup in: $PROJECT_ROOT"
echo "---"

# 1. Check package is installed
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '"nestjs-rest-query"' "$PROJECT_ROOT/package.json"; then
    pass "Package nestjs-rest-query found in package.json"
  else
    fail "Package not found in package.json" \
      "Run: pnpm add nestjs-rest-query  (or: npm install nestjs-rest-query)"
  fi
else
  fail "No package.json found in $PROJECT_ROOT" \
    "Are you running this from the project root?"
fi

# 2. Detect which ORM is in use (TypeORM is the default; Drizzle is opt-in)
HAS_TYPEORM=0
HAS_DRIZZLE=0
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '"typeorm"' "$PROJECT_ROOT/package.json"; then HAS_TYPEORM=1; fi
  if grep -q '"drizzle-orm"' "$PROJECT_ROOT/package.json"; then HAS_DRIZZLE=1; fi
fi

if [ $HAS_TYPEORM -eq 0 ] && [ $HAS_DRIZZLE -eq 0 ]; then
  fail "Neither typeorm nor drizzle-orm is installed" \
    "Install one peer ORM: pnpm add typeorm @nestjs/typeorm  OR  pnpm add drizzle-orm"
else
  [ $HAS_TYPEORM -eq 1 ] && pass "TypeORM detected in package.json"
  [ $HAS_DRIZZLE -eq 1 ] && pass "Drizzle ORM detected in package.json"
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

  # If Drizzle is installed, expect the adapter to be configured.
  if [ $HAS_DRIZZLE -eq 1 ] && [ $HAS_TYPEORM -eq 0 ]; then
    if grep -q "DrizzleAdapter" "$APP_MODULE"; then
      pass "DrizzleAdapter configured in $(basename "$APP_MODULE")"
    else
      fail "DrizzleAdapter not found in $(basename "$APP_MODULE")" \
        "Add: forRoot({ adapter: new DrizzleAdapter() }) and import from 'nestjs-rest-query/drizzle'"
    fi
  fi
else
  warn "Could not find app.module.ts — skipping module check"
fi

echo "---"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All checks passed.${NC}"
  exit 0
else
  echo -e "${RED}$ERRORS check(s) failed.${NC} Fix the issues above and re-run."
  exit 1
fi
