import { DataSource } from 'typeorm';

// ─── CLI Helpers ─────────────────────────────────────────────────────────────

/**
 * Lê o count da linha de comando.
 * Aceita argumento posicional (`seed:companies 50`) ou nomeado (`--count 50`).
 */
export function parseCount(defaultValue = 10): number {
  const args = process.argv.slice(2);

  // --count <n>
  const namedIdx = args.indexOf('--count');
  if (namedIdx !== -1 && args[namedIdx + 1]) {
    const n = parseInt(args[namedIdx + 1], 10);
    return isNaN(n) ? defaultValue : Math.max(1, n);
  }

  // primeiro argumento posicional numérico
  const positional = args.find((a) => /^\d+$/.test(a));
  if (positional) {
    return Math.max(1, parseInt(positional, 10));
  }

  return defaultValue;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export const logger = {
  info: (msg: string) => console.log(`${CYAN}ℹ ${msg}${RESET}`),
  success: (msg: string) => console.log(`${GREEN}✔ ${msg}${RESET}`),
  warn: (msg: string) => console.log(`${YELLOW}⚠ ${msg}${RESET}`),
  error: (msg: string) => console.log(`${RED}✖ ${msg}${RESET}`),
  title: (msg: string) => console.log(`\n${BOLD}${CYAN}▶ ${msg}${RESET}`),
  dim: (msg: string) => console.log(`${DIM}  ${msg}${RESET}`),
  divider: () => console.log(`${DIM}${'─'.repeat(60)}${RESET}`),
};

// ─── DataSource Lifecycle ────────────────────────────────────────────────────

export async function connectDataSource(dataSource: DataSource): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
    logger.success(`Conectado ao banco: ${dataSource.options.database}`);
  }
}

export async function disconnectDataSource(
  dataSource: DataSource,
): Promise<void> {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
    logger.dim('Conexão encerrada.');
  }
}

export async function runSeed(
  dataSource: DataSource,
  fn: (ds: DataSource) => Promise<void>,
): Promise<void> {
  try {
    await connectDataSource(dataSource);
    await fn(dataSource);
    logger.divider();
    logger.success('Seed concluído com sucesso!');
  } catch (err) {
    logger.error(`Erro durante o seed: ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await disconnectDataSource(dataSource);
  }
}

// ─── Document Formatters ─────────────────────────────────────────────────────

/** Gera um CPF fictício sem formatação (11 dígitos) */
export function generateRawCpf(seed?: string): string {
  // Usa 9 dígitos aleatórios + 2 dígitos verificadores fictícios
  const base = seed ?? Math.random().toString().slice(2, 11).padStart(9, '0');
  const d1 = Math.floor(Math.random() * 10);
  const d2 = Math.floor(Math.random() * 10);
  return `${base}${d1}${d2}`;
}

/** Formata CNPJ: XXXXXXXXXXXXXX → XX.XXX.XXX/XXXX-XX */
export function formatCnpj(raw: string): string {
  const n = raw.replace(/\D/g, '').padStart(14, '0');
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

/** Formata CPF: XXXXXXXXXXX → XXX.XXX.XXX-XX */
export function formatCpf(raw: string): string {
  const n = raw.replace(/\D/g, '').padStart(11, '0');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

// ─── Array Helpers ────────────────────────────────────────────────────────────

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomMany<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
