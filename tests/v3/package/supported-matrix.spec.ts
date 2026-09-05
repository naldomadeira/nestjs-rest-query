import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A matriz pública tem de coincidir com o que a CI executa (gate da §23).
 *
 * Sem este arquivo, `docs/v3/versions.md` é uma promessa mantida à mão em dois
 * lugares — que é a definição de drift. O gate não pede uma tabela gerada: pede
 * que a tabela **coincida**. Comparar é mais fácil de manter correto que
 * derivar, e uma tabela gerada seria uma tabela que ninguém escreveu e por isso
 * ninguém lê.
 */

const ROOT = join(__dirname, '..', '..', '..');

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const versions = read('docs', 'v3', 'versions.md');
const matrixWorkflow = read('.github', 'workflows', 'database-matrix.yml');
const ciWorkflow = read('.github', 'workflows', 'ci.yml');
const pkg = JSON.parse(read('package.json')) as {
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('a matriz pública coincide com a CI', () => {
  it('declara os mesmos adapters que o workflow', () => {
    const declared = /adapter:\s*\[([^\]]+)\]/.exec(matrixWorkflow)?.[1];
    const adapters = declared!.split(',').map((name) => name.trim());

    expect(adapters).toEqual(['typeorm', 'prisma', 'drizzle']);

    for (const adapter of adapters) {
      // A tabela nomeia os adapters em negrito e com inicial maiúscula.
      const label = adapter === 'typeorm' ? 'TypeORM' : adapter;
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      expect(versions).toContain(`**${capitalized}**`);
    }
  });

  it('declara os mesmos dialetos que o workflow, e nenhum a mais', () => {
    // O workflow lista os dialetos completos no ramo de `push`; o de pull
    // request é o subconjunto de diagnóstico e não define o suportado.
    const full = /fromJSON\('\["postgres","mysql","mssql"\]'\)/.test(
      matrixWorkflow
    );

    expect(full).toBe(true);
    expect(versions).toContain('PostgreSQL');
    expect(versions).toContain('MySQL');
    expect(versions).toContain('SQL Server');
    // SQLite é dialeto de referência, nunca célula: a página tem de dizer isso.
    expect(versions).toContain('O SQLite **não** é célula');
  });

  it('declara a mesma versão de Node que a matriz executa', () => {
    const nodeVersion = /node-version:\s*(\d+)/.exec(matrixWorkflow)?.[1];

    expect(nodeVersion).toBe('24');
    // Regex, não string exata: o prettier re-alinha o padding da tabela quando
    // uma linha mais longa entra, e a asserção quebraria pelo motivo errado.
    expect(versions).toMatch(/\|\s*Node\.js\s*\|\s*24\.x/);

    // A `ci` roda a suíte unitária também na versão de compatibilidade.
    const ciNodes = /node:\s*\[([^\]]+)\]/.exec(ciWorkflow)?.[1];
    expect(ciNodes?.replace(/\s/g, '')).toBe('22,24');
  });

  it('declara as mesmas imagens de banco que o perfil certificado', () => {
    const compose = read('test', 'profiles', 'docker-compose.yml');

    for (const image of [
      'postgres:18',
      'mysql:8.4',
      'mcr.microsoft.com/mssql/server:2022-latest',
    ]) {
      expect(compose).toContain(image);
      expect(versions).toContain(image);
    }
  });

  it('declara as mesmas faixas de peer que o package.json', () => {
    // A faixa é o mecanismo que sustenta a promessa: se a página disser uma
    // coisa e o `package.json` outra, o instalador ganha e a página mente.
    const escapePipes = (range: string) => range.replace(/\|\|/g, '\\|\\|');

    for (const peer of [
      'typeorm',
      '@prisma/client',
      'drizzle-orm',
      '@nestjs/common',
    ]) {
      const range = pkg.peerDependencies[peer];
      expect(range).toBeDefined();
      expect(versions).toContain(escapePipes(range));
    }
  });

  it('declara a versão de Prisma que o repositório fixa', () => {
    // CLI e client têm de ser a mesma versão (§6.2), e a página nomeia ela.
    expect(pkg.devDependencies.prisma).toBe(
      pkg.devDependencies['@prisma/client']
    );
    expect(versions).toContain(pkg.devDependencies.prisma);
  });

  it('declara a versão de Drizzle que o repositório fixa', () => {
    expect(versions).toContain(pkg.devDependencies['drizzle-orm']);
  });
});
