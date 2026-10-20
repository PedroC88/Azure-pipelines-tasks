const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['eslint.config.js', 'jest.config.js', 'fs.realpath.js', '**/*.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];
