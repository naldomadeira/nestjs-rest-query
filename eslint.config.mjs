import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { files: ['**/*.js'], languageOptions: { sourceType: 'script' } },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // O prefixo `_` é a declaração explícita de "existe de propósito, não é
      // consumido": parâmetros de assinatura obrigatória, catch descartado e
      // aliases de *type test* (`type _XIsReadonly = Expect<...>`), que valem
      // pela checagem em tempo de compilação e nunca são referenciados.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Fixture de consumidor CommonJS: o `require()` é o objeto do teste
    // (provar que o pacote publicado é requerível de CJS), não um descuido.
    files: ['tests/v3/package/consumer-fixtures/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: [
      'node_modules/*',
      'dist/*',
      'coverage/*',
      // Saída do `nest build` dos exemplos: JavaScript compilado, não fonte.
      'apps/examples/*/dist/**',
      // Client Prisma gerado no exemplo 04 (generator `prisma-client`), não é
      // código do projeto.
      'apps/examples/04-app-with-prisma/src/generated/**',
      // Client Prisma gerado pelo harness do corpus, não é código do projeto.
      'tests/v3/adapters/prisma/generated/*',
      // Gerado pelo fumadocs-mdx no `postinstall` do apps/docs (e ignorado no
      // git): editar à mão é inútil, volta no próximo install.
      'apps/docs/.source/**',
      // Artefatos de build/geração do site de docs.
      'apps/docs/.next/**',
      'apps/docs/out/**',
      'apps/docs/public/skills/**',
    ],
  },
];
