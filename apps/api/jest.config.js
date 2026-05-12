/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleNameMapper: {
    "^@pokertable/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@pokertable/config$": "<rootDir>/../../packages/config/src/index.ts"
  },
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.json"
      }
    ]
  }
};
