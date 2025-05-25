module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'prettier/prettier': ['error', { endOfLine: 'off' }],
    'no-console': 'off', // Allow console.log statements
    'no-unused-vars': 'warn', // Change unused variables to warnings instead of errors
    'no-undef': 'off', // Disable errors for undefined variables
    '@typescript-eslint/no-unsafe-call': 'off', // Ignore unsafe call errors
    '@typescript-eslint/no-unsafe-argument': 'off', // Ignore unsafe argument errors
    '@typescript-eslint/no-unsafe-member-access': 'off', // Ignore unsafe member access errors
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Ignore variables starting with '_'
  },
};
