// Jest-Konfiguration fuer das Backend.
//
// Bewusst minimal und DB-frei gehalten:
// - preset 'ts-jest' kompiliert die .spec.ts-Dateien mit der vorhandenen
//   backend/tsconfig.json (experimentalDecorators + emitDecoratorMetadata aktiv,
//   strictNullChecks:false -> Teil-Mocks mit `any` sind erlaubt).
// - KEIN moduleNameMapper: tsconfig hat baseUrl:"./" aber KEINE paths/@-Aliase,
//   alle internen Imports im Code sind relativ. Ein Mapper waere ueberfluessig.
// - KEIN globalSetup/DataSource -> es wird nie eine echte DB-Verbindung gebootet,
//   damit better-sqlite3/pg (nativer Treiber) niemals geladen werden muss. Die
//   Specs testen ausschliesslich reine Funktionen + einfache Repo-Mocks.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
};
