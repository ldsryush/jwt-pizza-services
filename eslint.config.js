const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
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
