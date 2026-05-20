/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@pokertable/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@pokertable/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@pokertable/poker-engine$": "<rootDir>/../../packages/poker-engine/src/index.ts"
  },
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "Node",
          target: "ES2022",
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true
        }
      }
    ]
  }
};
