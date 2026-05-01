import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, ExternalLink, Sparkles } from 'lucide-react';

import { skills } from '@/lib/skills';

export const metadata: Metadata = {
  title: 'Skills',
  description:
    'Skills for AI coding agents (Claude Code, Cursor, etc.) that help install, configure, and troubleshoot nestjs-rest-query.',
};

export default function SkillsPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10 flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-fd-border bg-fd-muted/40 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          <Sparkles className="size-3.5" />
          For AI coding agents
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Skills</h1>
        <p className="max-w-2xl text-fd-muted-foreground">
          Drop-in capability bundles that teach AI coding agents (Claude Code, Cursor, Copilot)
          how to install, configure, and troubleshoot <code>nestjs-rest-query</code>. Download
          the zip and follow your agent's instructions for adding skills, or browse the source
          on GitHub.
        </p>
      </header>

      {skills.length === 0 ? (
        <div className="rounded-lg border border-fd-border bg-fd-muted/40 p-6 text-center text-fd-muted-foreground">
          No skills available yet.
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex flex-col gap-4 rounded-xl border border-fd-border bg-fd-card p-6 transition-colors hover:border-fd-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-lg font-semibold">{skill.name}</h2>
                  {skill.version ? (
                    <span className="text-xs font-mono text-fd-muted-foreground">
                      v{skill.version}
                    </span>
                  ) : null}
                </div>
                {skill.category ? (
                  <span className="shrink-0 rounded-md bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary">
                    {skill.category}
                  </span>
                ) : null}
              </div>

              <p className="line-clamp-4 text-sm text-fd-muted-foreground">
                {skill.description}
              </p>

              {skill.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {skill.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md border border-fd-border px-2 py-0.5 text-xs text-fd-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <a
                  href={skill.downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-3 py-1.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Download className="size-4" />
                  Download .zip
                </a>
                <Link
                  href={skill.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-muted/40"
                >
                  <ExternalLink className="size-4" />
                  View on GitHub
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12 rounded-xl border border-fd-border bg-fd-muted/30 p-6">
        <h2 className="mb-2 text-lg font-semibold">How to use a skill</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-fd-muted-foreground">
          <li>Download the <code>.zip</code> for the skill you want.</li>
          <li>
            Unzip it into the location your agent reads from
            (Claude Code: <code>~/.claude/skills/</code> or <code>.claude/skills/</code> in
            your project).
          </li>
          <li>
            The skill's <code>SKILL.md</code> describes when the agent should activate it —
            no further configuration needed.
          </li>
        </ol>
      </section>
    </main>
  );
}
