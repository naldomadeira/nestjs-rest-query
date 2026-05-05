/**
 * Seed: full dataset for the Prisma sample app.
 *
 * Inserts companies → users → posts so the `.http` files have realistic
 * data to query against. Mirrors `03-app-with-drizzle/src/database/seed.ts`
 * row counts and shapes — the only difference is the ORM.
 *
 * Usage:
 *   pnpm seed
 *   pnpm seed --users 30 --posts 5
 *
 * Optional flags:
 *   --users <n>   Users per company (default: 3)
 *   --posts <n>   Posts per user    (default: 2)
 *   --reset       Drop rows before insert
 */
import { PrismaClient } from '@prisma/client';

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
  'Why we chose Prisma',
  'A note on pagination',
  'Postgres tips',
  'Migrating from TypeORM',
  'Production deployment notes',
  'Schema design lessons',
  'Backups and recovery',
];

function companySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function makeEmail(firstName: string, slug: string, idx: number): string {
  return `${firstName.toLowerCase()}.${idx}@${slug}.com`;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   SEED — 04-app-with-prisma          ║`);
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
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});
  }

  console.log('→ Inserting companies…');
  const companies = await Promise.all(
    COMPANY_NAMES.map((name) => prisma.company.create({ data: { name } }))
  );
  console.log(`  ${companies.length} companies inserted.`);

  console.log('→ Inserting users…');
  let userIdx = 0;
  const users: { id: string; name: string }[] = [];
  for (const company of companies) {
    const slug = companySlug(company.name);
    for (let i = 0; i < USERS_PER_COMPANY; i++) {
      const firstName = FIRST_NAMES[userIdx % FIRST_NAMES.length];
      const email = makeEmail(firstName, slug, userIdx);
      const user = await prisma.user.create({
        data: { name: firstName, email, companyId: company.id },
      });
      users.push({ id: user.id, name: user.name });
      userIdx++;
    }
  }
  console.log(`  ${users.length} users inserted.`);

  // Orphan users (no company) so the `isNull` filter has rows to find.
  const orphans = await Promise.all(
    [
      { name: 'Orphan One', email: 'orphan1@example.com' },
      { name: 'Orphan Two', email: 'orphan2@example.com' },
    ].map((data) => prisma.user.create({ data }))
  );
  console.log(`  ${orphans.length} orphan users (no company).`);

  console.log('→ Inserting posts…');
  let postIdx = 0;
  const postValues: { title: string; content: string; userId: string }[] = [];
  for (const user of users) {
    for (let i = 0; i < POSTS_PER_USER; i++) {
      const title = POST_TITLES[postIdx % POST_TITLES.length];
      postValues.push({
        title: `${title} #${postIdx}`,
        content: `Content of post ${postIdx} authored by ${user.name}.`,
        userId: user.id,
      });
      postIdx++;
    }
  }
  if (postValues.length > 0) {
    const result = await prisma.post.createMany({ data: postValues });
    console.log(`  ${result.count} posts inserted.`);
  }

  console.log(`\n✓ Seed complete.`);
  console.log(`  Tip: pnpm dev — sample app boots on http://localhost:3003`);
  console.log(`  Tip: try src/http/users.http for ready-made requests.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
