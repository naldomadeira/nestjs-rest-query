import manifest from './skills-manifest.generated.json';

export type Skill = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string | null;
  readonly category: string | null;
  readonly tags: readonly string[];
  readonly author: string | null;
  readonly downloadUrl: string;
  readonly githubUrl: string;
};

type SkillsManifest = {
  readonly generatedAt: string;
  readonly skills: readonly Skill[];
};

const typedManifest = manifest as SkillsManifest;

export const skills = typedManifest.skills;
export const skillsGeneratedAt = typedManifest.generatedAt;
