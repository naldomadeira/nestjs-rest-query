#!/usr/bin/env node
/**
 * Gate "sem skips" da matriz de banco (spec §6.2 e §19).
 *
 * Uma célula que pula casos silenciosamente passaria no CI sem provar nada.
 * Este script lê o relatório JUnit da suíte de integração e falha se algum
 * caso foi pulado ou se nenhum caso rodou.
 */
import { readFileSync } from 'node:fs';

const reportPath = process.argv[2] ?? 'junit.xml';

let xml;
try {
  xml = readFileSync(reportPath, 'utf8');
} catch {
  console.error(
    `assert-no-skips: report not found at ${reportPath}; the integration suite did not run`
  );
  process.exit(1);
}

const attribute = (name) => {
  let total = 0;
  for (const match of xml.matchAll(
    new RegExp(`<testsuites[^>]*\\b${name}="(\\d+)"`, 'g')
  )) {
    total += Number(match[1]);
  }
  return total;
};

const tests = attribute('tests');
const skipped = xml.match(/<skipped\b/g)?.length ?? 0;

if (tests === 0) {
  console.error('assert-no-skips: the integration suite reported zero tests');
  process.exit(1);
}

if (skipped > 0) {
  console.error(
    `assert-no-skips: ${skipped} of ${tests} integration cases were skipped; the matrix must be green without skips`
  );
  process.exit(1);
}

console.log(`assert-no-skips: ${tests} integration cases ran, none skipped`);
