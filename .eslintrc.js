module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'android/app/build/**',
    'android/.gradle/**',
    'android/app/.cxx/**',
  ],
  overrides: [
    {
      files: ['server/**/*.js'],
      env: { node: true },
    },
    {
      files: ['android/app/src/main/assets/cms/**/*.js', 'server/public/**/*.js'],
      env: { browser: true, node: true },
    },
  ],
};
