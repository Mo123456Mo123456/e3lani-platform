/** Shared ESLint baseline for إعلاني workspaces. */
module.exports = {
  root: false,
  ignorePatterns: ['dist', '.next', 'node_modules', 'coverage'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
};
