/**
 * Seed: full dataset for the Drizzle sample app.
 *
 * Inserts companies → users → posts with deterministic UUIDs so the
 * `.http` files can reference specific IDs in `?filter[userId][in]=...`
 * etc. without re-fetching.
 *
 * Usage:
 *   pnpm seed
 *   pnpm seed --users 30 --posts 5
 *
 * Optional flags:
 *   --users  <n>   Users per company (default: 3 → 15 total with 5 companies)
 *   --posts  <n>   Posts per user    (default: 2 → ~30 total)
 *   --reset        Drop rows before insert
 *
 * Idempotent: uses `onConflictDoNothing()` on natural keys (email, slug-ish).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { companies, posts, users } from '../db/schema';

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArg(flag: string, fallback: number): number {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    return isNaN(n) ? fallback : Math.max(1, n);
  }
  return fallback;
}

const USERS_PER_COMPANY = parseArg('--users', 3);
const POSTS_PER_USER = parseArg('--posts', 2);
const RESET = process.argv.includes('--reset');

// ─── Static data ─────────────────────────────────────────────────────────────

const COMPANY_NAMES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli'];

const FIRST_NAMES = [
  'Ana',
  'Bia',
  'Caio',
  'Diego',
  'Elena',
  'Fabio',
  'Gabi',
  'Hugo',
  'Iara',
  'Joao',
  'Karen',
  'Luca',
  'Mariana',
  'Nuno',
  'Olivia',
];

const POST_TITLES = [
  'Hello, world',
  'Why we chose Drizzle',
  'A note on pagination',
  'Postgres tips',
  'Migrating from TypeORM',
  'Production deployment notes',
  'Schema design lessons',
  'Backups and recovery',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmail(
  firstName: string,
  companySlug: string,
  idx: number
): string {
  return `${firstName.toLowerCase()}.${idx}@${companySlug}.com`;
}

function companySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const url = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5433}/${process.env.DB_NAME || 'app_db_drizzle'}`;
  const client = postgres(url);
  const db = drizzle(client);

  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   SEED — 03-app-with-drizzle         ║`);
  console.log(`╠══════════════════════════════════════╣`);
  console.log(
    `║  Companies:       ${String(COMPANY_NAMES.length).padEnd(20)}║`
  );
  console.log(`║  Users / company: ${String(USERS_PER_COMPANY).padEnd(20)}║`);
  console.log(`║  Posts / user:    ${String(POSTS_PER_USER).padEnd(20)}║`);
  console.log(`║  Reset:           ${String(RESET).padEnd(20)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  if (RESET) {
    console.log('→ Wiping existing rows…');
    await db.delete(posts);
    await db.delete(users);
    await db.delete(companies);
  }

  // ── Companies ─────────────────────────────────────────────────────────────
  console.log('→ Inserting companies…');
  const insertedCompanies = await db
    .insert(companies)
    .values(COMPANY_NAMES.map((name) => ({ name })))
    .returning();
  console.log(`  ${insertedCompanies.length} companies inserted.`);

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('→ Inserting users…');
  let userIdx = 0;
  const userValues = insertedCompanies.flatMap((company) => {
    const slug = companySlug(company.name);
    return Array.from({ length: USERS_PER_COMPANY }, () => {
      const firstName = FIRST_NAMES[userIdx % FIRST_NAMES.length];
      const email = makeEmail(firstName, slug, userIdx);
      const value = {
        name: firstName,
        email,
        companyId: company.id,
      };
      userIdx++;
      return value;
    });
  });
  const insertedUsers = await db
    .insert(users)
    .values(userValues)
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(`  ${insertedUsers.length} users inserted.`);

  // Some users without a company (test isNull filter on companyId)
  const orphanUsers = await db
    .insert(users)
    .values([
      { name: 'Orphan One', email: 'orphan1@example.com', companyId: null },
      { name: 'Orphan Two', email: 'orphan2@example.com', companyId: null },
    ])
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(`  ${orphanUsers.length} orphan users (no company).`);

  // ── Posts ─────────────────────────────────────────────────────────────────
  console.log('→ Inserting posts…');
  let postIdx = 0;
  const postValues = insertedUsers.flatMap((user) =>
    Array.from({ length: POSTS_PER_USER }, () => {
      const title = POST_TITLES[postIdx % POST_TITLES.length];
      const value = {
        title: `${title} #${postIdx}`,
        content: `Content of post ${postIdx} authored by ${user.name}.`,
        userId: user.id,
      };
      postIdx++;
      return value;
    })
  );
  if (postValues.length > 0) {
    const insertedPosts = await db.insert(posts).values(postValues).returning();
    console.log(`  ${insertedPosts.length} posts inserted.`);
  }

  console.log(`\n✓ Seed complete.`);
  console.log(`  Tip: pnpm dev — sample app boots on http://localhost:3002`);
  console.log(`  Tip: try src/http/users.http for ready-made requests.`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
