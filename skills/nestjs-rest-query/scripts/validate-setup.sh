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

# 1b. Detect the API line: 2.x and 3.x need different setups.
LINE="unknown"
if [ -f "$PROJECT_ROOT/package.json" ]; then
  RANGE=$(grep -o '"nestjs-rest-query"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_ROOT/package.json" | sed 's/.*:[[:space:]]*"\(.*\)"/\1/' || true)
  INSTALLED=""
  if [ -f "$PROJECT_ROOT/node_modules/nestjs-rest-query/package.json" ]; then
    INSTALLED=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_ROOT/node_modules/nestjs-rest-query/package.json" | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/')
  fi
  VERSION="${INSTALLED:-$RANGE}"
  case "$VERSION" in
    *3.*|alpha|*alpha*) LINE="3.x" ;;
    *2.*|latest) LINE="2.x" ;;
  esac
  SRC_DIR="$PROJECT_ROOT/src"
  if [ -d "$SRC_DIR" ]; then
    if grep -rqE "typeormSource|prismaSource|drizzleSource|defineQueryRules" "$SRC_DIR" 2>/dev/null; then
      CODE_LINE="3.x"
    elif grep -rqE "RulesConfig|forRoot\(\{[^}]*adapter" "$SRC_DIR" 2>/dev/null; then
      CODE_LINE="2.x"
    else
      CODE_LINE=""
    fi
    if [ -n "$CODE_LINE" ] && [ "$LINE" != "unknown" ] && [ "$CODE_LINE" != "$LINE" ]; then
      warn "package.json says $LINE but the code uses the $CODE_LINE API — migration in progress? See MIGRATION.md \"2.x → 3.x\""
    fi
    [ "$LINE" = "unknown" ] && [ -n "$CODE_LINE" ] && LINE="$CODE_LINE"
  fi
  echo "Detected API line: $LINE (version: ${VERSION:-none})"
  if [ "$VERSION" = "3.0.0-alpha.0" ]; then
    warn "3.0.0-alpha.0 has known defects fixed in later alphas (decimal/date filters, TypeORM many-relation filters, Swagger interceptor, uncapped paginate=false) — upgrade: pnpm add nestjs-rest-query@alpha"
  fi
fi

# 2. Detect which ORM is in use
HAS_TYPEORM=0
HAS_DRIZZLE=0
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '"typeorm"' "$PROJECT_ROOT/package.json"; then HAS_TYPEORM=1; fi
  if grep -q '"drizzle-orm"' "$PROJECT_ROOT/package.json"; then HAS_DRIZZLE=1; fi
fi

HAS_PRISMA=0
if [ -f "$PROJECT_ROOT/package.json" ] && grep -q '"@prisma/client"' "$PROJECT_ROOT/package.json"; then HAS_PRISMA=1; fi

if [ $HAS_TYPEORM -eq 0 ] && [ $HAS_DRIZZLE -eq 0 ] && [ $HAS_PRISMA -eq 0 ]; then
  fail "No supported ORM (typeorm, drizzle-orm, @prisma/client) is installed" \
    "Install one peer ORM: pnpm add typeorm @nestjs/typeorm  OR  drizzle-orm  OR  @prisma/client"
else
  [ $HAS_TYPEORM -eq 1 ] && pass "TypeORM detected in package.json"
  [ $HAS_DRIZZLE -eq 1 ] && pass "Drizzle ORM detected in package.json"
  [ $HAS_PRISMA -eq 1 ] && pass "Prisma Client detected in package.json"
fi

# 3. Check main.ts for query parser
MAIN_FILE=""
for f in "$PROJECT_ROOT/src/main.ts" "$PROJECT_ROOT/main.ts"; do
  if [ -f "$f" ]; then MAIN_FILE="$f"; break; fi
done

if [ -n "$MAIN_FILE" ]; then
  if grep -rqE "query parser['\"][[:space:]]*,[[:space:]]*['\"]extended" "$PROJECT_ROOT/src" 2>/dev/null; then
    pass "Extended query parser configured (searched src/)"
  else
    fail "Missing extended query parser in $(basename "$MAIN_FILE")" \
      "Add: app.set('query parser', 'extended');"
  fi

  if [ "$LINE" = "3.x" ]; then
    if grep -q "whitelist:[[:space:]]*true" "$MAIN_FILE"; then
      warn "ValidationPipe({ whitelist: true }) strips DynamicQueryDto in 3.x — read the query with a custom param decorator (see references/v3/setup.md)"
    fi
  elif grep -q "enableImplicitConversion" "$MAIN_FILE"; then
    pass "enableImplicitConversion found in $(basename "$MAIN_FILE")"
  else
    fail "Missing enableImplicitConversion in $(basename "$MAIN_FILE")" \
      "Add ValidationPipe with: transformOptions: { enableImplicitConversion: true }"
  fi

  if [ "$LINE" = "3.x" ]; then
    : # 3.x validates the query itself; a global ValidationPipe is optional.
  elif grep -q "ValidationPipe" "$MAIN_FILE"; then
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

  if [ "$LINE" = "3.x" ] && grep -qE "forRoot\(\{[^)]*(adapter|operators)" "$APP_MODULE"; then
    fail "forRoot receives adapter/operators, which 3.x refuses at startup" \
      "Remove them: the adapter comes from typeormSource/prismaSource/drizzleSource, operators from defineQueryRules"
  fi

  # 2.x only: with Drizzle installed, expect the adapter to be configured.
  if [ "$LINE" != "3.x" ] && [ $HAS_DRIZZLE -eq 1 ] && [ $HAS_TYPEORM -eq 0 ]; then
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
