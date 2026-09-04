import fc from 'fast-check';

/**
 * Seed fixo para o `fast-check`, e o motivo é cobertura, não gosto por
 * determinismo.
 *
 * Com seed aleatório, cada execução visita entradas diferentes e a cobertura
 * oscila com a *mesma* contagem de testes: `validate-pagination.ts` já foi
 * medido variando entre 91.17% e 97.05% sem que uma linha de teste mudasse.
 * Hoje isso não trava nada porque não há `coverageThreshold`; no dia em que
 * houver, travaria de forma intermitente — o pior tipo de gate, o que reprova
 * quem não mexeu em nada.
 *
 * O que se perde com o seed fixo é exploração ao longo do tempo, e o que se
 * ganha é reprodutibilidade: uma falha encontrada aqui é reproduzível por
 * quem quer que rode a suíte. A exploração passa a ser deliberada — trocar
 * este número é um diff revisável, e o commit que o troca carrega a razão.
 *
 * `verbose` faz o relatório trazer a contra-entrada minimizada em vez de só
 * "property failed", que é o que torna uma falha de propriedade diagnosticável.
 */
fc.configureGlobal({
  seed: 20260904,
  verbose: fc.VerbosityLevel.Verbose,
});
