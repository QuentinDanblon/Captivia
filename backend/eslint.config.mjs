// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Convention du projet : un paramètre ou une variable préfixé par « _ » est
      // volontairement inutilisé (signature imposée par un contrat, un décorateur ou
      // une interface).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // `import x = require('pkg')` est la forme TypeScript des modules CommonJS à
      // `export =` (ex. memcached) : le projet compile en CommonJS sans esModuleInterop.
      '@typescript-eslint/no-require-imports': [
        'error',
        { allowAsImport: true },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // Les matchers asymétriques de Jest (expect.any, expect.objectContaining,
      // expect.stringMatching…) sont typés `any` par @types/jest : les placer dans un
      // objet attendu déclenche no-unsafe-assignment sans aucun risque réel de typage.
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
