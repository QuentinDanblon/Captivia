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
);
