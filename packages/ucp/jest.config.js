module.exports = {
    clearMocks: true,
    moduleFileExtensions: ['ts', 'js'],
    roots: ['<rootDir>/test/'],
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    collectCoverage: true,
    coverageReporters: ['text', 'lcov'],
    coveragePathIgnorePatterns: [
        '/dist/',
        '/node_modules/',
    ],
    moduleNameMapper: {
        '^jose/(.*)$': '<rootDir>/node_modules/jose/dist/node/cjs/$1',
    },
    testTimeout: 60000,
    setupFilesAfterEnv: ["jest-rdf"]
}