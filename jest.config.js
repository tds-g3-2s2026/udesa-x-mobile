module.exports = {
  preset: 'jest-expo',
  // @react-navigation ships only an ESM build with a nested {"type":"module"},
  // which Jest running in CommonJS refuses to require. It publishes its source
  // too, and transformIgnorePatterns already lets Babel compile it.
  //
  // On Windows this never showed: Jest misses that nested package.json and
  // treats the file as CommonJS, so the suite passed there and only broke on
  // Linux, which is where the CI runs.
  moduleNameMapper: {
    '^@react-navigation/([a-z-]+)$': '<rootDir>/node_modules/@react-navigation/$1/src/index.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  // Every source file is reported, tested or not: otherwise the percentage only
  // describes what somebody already remembered to cover.
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!app/+not-found.tsx',
  ],
  coverageDirectory: 'coverage',
  // cobertura is what the reusable workflow parses, the same format the Python
  // services emit.
  coverageReporters: ['text-summary', 'cobertura'],
  reporters: ['default', ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }]],
};
