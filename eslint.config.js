//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      // react-hooks plugin is not installed/configured; disable the rule to avoid "Definition for rule ... was not found" errors
      'react-hooks/exhaustive-deps': 'off',
      // Disable overly aggressive no-unnecessary-condition rule that flags defensive programming patterns used throughout the codebase
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
