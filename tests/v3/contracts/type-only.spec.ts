import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * `src/contracts` não é medível por cobertura — e este teste é o que separa
 * "não medido" de "nada a medir".
 *
 * O `coveragePathIgnorePatterns` do `jest.config.ts` exclui `index.ts$` e
 * `.interface.ts$`, e todo arquivo de `src/contracts` casa um dos dois. O
 * efeito colateral é perverso: o gate da §23 pede 95% de branches nos
 * caminhos críticos, e sobre os contratos ele nunca é atingido *nem
 * reprovado* — só ausente. Um gate que não pode reprovar parece medido e não
 * é, que é a pior das três saídas listadas no plano de entrega.
 *
 * A saída honesta não é mudar o alvo nem abrir exceção no ignore: é provar
 * que ali não existe código para executar. A asserção é sobre o JavaScript
 * *emitido*, não sobre a forma do fonte — `const`, `enum` não-const e classe
 * passariam por qualquer heurística textual e apareceriam aqui na hora.
 *
 * O que é permitido no emitido são apenas declarações de import/export, e
 * elas existem de fato: `src/contracts/index.ts` emite `export * from './v3'`
 * porque, arquivo por arquivo, o transpilador não pode provar que o alvo é
 * type-only. Reexport encaminha nome, não executa instrução: nenhum branch,
 * nenhuma chamada, nada que cobertura pudesse medir. Qualquer outra forma de
 * instrução reprova.
 *
 * No dia em que alguém puser runtime num contrato, este teste falha e a
 * decisão volta à mesa — em vez de o arquivo entrar calado numa pasta que a
 * cobertura não olha.
 */
const CONTRACTS_DIR = join(__dirname, '../../../src/contracts');

function collectTs(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectTs(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/**
 * Instruções do emitido que **não** são encaminhamento de módulo.
 *
 * `isolatedModules` é deliberado: é o mesmo modo em que o `ts-jest` roda, de
 * modo que o que este teste inspeciona é o mesmo JavaScript que a suíte
 * carregaria.
 */
function executableStatements(source: string): readonly string[] {
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      removeComments: true,
      isolatedModules: true,
    },
  }).outputText;

  const parsed = ts.createSourceFile(
    'emitted.js',
    emitted,
    ts.ScriptTarget.ES2022,
    false,
    ts.ScriptKind.JS
  );

  return parsed.statements
    .filter(
      (statement) =>
        !ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)
    )
    .map((statement) => statement.getText(parsed).trim());
}

describe('src/contracts é type-only', () => {
  const files = collectTs(CONTRACTS_DIR);

  it('encontra os contratos onde eles estão', () => {
    // Guarda contra o teste silenciosamente não testar nada: uma pasta
    // renomeada faria `collectTs` devolver lista vazia e todos os `it.each`
    // abaixo desapareceriam sem uma falha.
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  it.each(files.map((file) => [file.split('/src/')[1], file] as const))(
    '%s não emite código executável',
    (_relative, file) => {
      expect(executableStatements(readFileSync(file, 'utf8'))).toEqual([]);
    }
  );

  it('reprova um contrato que ganhe runtime', () => {
    // O teste acima só vale se puder falhar. Uma interface acompanhada de um
    // `const` é exatamente o que passaria calado pela pasta ignorada.
    expect(
      executableStatements(
        'export interface Only { a: string }\nexport const LIMIT = 10;\n'
      )
    ).toEqual(['export const LIMIT = 10;']);
  });
});
