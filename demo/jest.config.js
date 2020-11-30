module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^oa-client-generator/lib/(.+)$": "<rootDir>/../src/$1",
  },
  restoreMocks: true,
};
