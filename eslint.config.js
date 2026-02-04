const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
];
