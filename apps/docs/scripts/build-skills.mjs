#!/usr/bin/env node
/**
 * Scans `<repo>/skills/*` and produces:
 *   - `apps/docs/public/skills/<id>.zip` (downloadable artifact)
 *   - `apps/docs/lib/skills-manifest.generated.json` (typed manifest the
 *     /skills page renders)
 *
 * Source of truth for each skill:
 *   - `SKILL.md` (frontmatter: name, description)
 *   - `skills-registry.remote.json` (optional: tags, version, category)
 *   - `README.md` (fallback short description)
 */

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(DOCS_ROOT, '..', '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const PUBLIC_OUT = join(DOCS_ROOT, 'public', 'skills');
const MANIFEST_OUT = join(DOCS_ROOT, 'lib', 'skills-manifest.generated.json');

const GITHUB_REPO = 'naldomadeira/nestjs-rest-query';
const GITHUB_BRANCH = 'main';

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---', 4);
  if (end === -1) return {};
  const block = content.slice(4, end);
  const fm = {};
  let currentKey = null;
  let multiline = [];
  for (const line of block.split('\n')) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      if (currentKey && multiline.length) {
        fm[currentKey] = multiline.join('\n').trim();
        multiline = [];
      }
      const [, key, value] = match;
      currentKey = key;
      if (value === '|' || value === '>') {
        multiline = [];
      } else if (value !== '') {
        fm[key] = value.replace(/^['"]|['"]$/g, '');
        currentKey = null;
      }
    } else if (currentKey && line.startsWith('  ')) {
      multiline.push(line.slice(2));
    }
  }
  if (currentKey && multiline.length) {
    fm[currentKey] = multiline.join('\n').trim();
  }
  return fm;
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function listSkills() {
  let entries;
  try {
    entries = readdirSync(SKILLS_DIR);
  } catch {
    return [];
  }
  return entries
    .map((name) => ({ id: name, path: join(SKILLS_DIR, name) }))
    .filter(({ path }) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });
}

function buildSkill({ id, path }) {
  const skillMd = readFileSync(join(path, 'SKILL.md'), 'utf8');
  const frontmatter = parseFrontmatter(skillMd);
  const registry =
    readJsonSafe(join(path, 'skills-registry.remote.json')) ?? {};

  const zipName = `${id}.zip`;
  const zipPath = join(PUBLIC_OUT, zipName);

  // Pack from the parent of the skill so the zip extracts as `<id>/...`.
  rmSync(zipPath, { force: true });
  execFileSync('zip', ['-rq', zipPath, id], {
    cwd: SKILLS_DIR,
    stdio: 'inherit',
  });

  return {
    id,
    name: frontmatter.name ?? id,
    description: (frontmatter.description ?? registry.description ?? '').trim(),
    version: registry.version ?? null,
    category: registry.category ?? null,
    tags: Array.isArray(registry.tags) ? registry.tags : [],
    author: registry.author ?? null,
    downloadUrl: `/skills/${zipName}`,
    githubUrl: `https://github.com/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/skills/${id}`,
  };
}

function main() {
  mkdirSync(PUBLIC_OUT, { recursive: true });
  mkdirSync(dirname(MANIFEST_OUT), { recursive: true });

  const skills = listSkills();
  if (skills.length === 0) {
    console.warn(`[skills] no skills found in ${SKILLS_DIR}`);
  }

  const built = skills.map((skill) => {
    console.log(`[skills] packaging ${skill.id}`);
    return buildSkill(skill);
  });

  writeFileSync(
    MANIFEST_OUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), skills: built },
      null,
      2
    ) + '\n'
  );
  console.log(`[skills] wrote ${built.length} skill(s) to manifest`);
}

main();
