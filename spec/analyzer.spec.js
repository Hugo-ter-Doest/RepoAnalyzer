const path = require('path');
const { analyzeRepository } = require('../lib/analyzer');
const { createTempDir, writeFile, removeDir } = require('./helpers/temp-fs');

describe('analyzer analyzeRepository', () => {
  const tempDirs = [];

  function createRepo() {
    const repoPath = createTempDir('repo-analyzer-agg-spec-');
    tempDirs.push(repoPath);
    return repoPath;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      removeDir(tempDirs.pop());
    }
  });

  it('aggregates code and specification metrics with API summaries', async () => {
    const repoPath = createRepo();
    writeFile(repoPath, 'package.json', JSON.stringify({ name: 'demo', version: '2.3.4' }, null, 2));
    writeFile(repoPath, 'src/api.js', [
      "import express from 'express';",
      "const axios = require('axios');",
      '',
      'class ApiController {}',
      '',
      'function handle() {',
      '  return true;',
      '}',
      '',
      "app.get('/api/users', handle);",
      "app.post('/api/users', handle);"
    ].join('\n'));
    writeFile(repoPath, 'config/settings.json', JSON.stringify({ env: 'test' }, null, 2));

    const result = await analyzeRepository(repoPath);

    expect(result.version).toBe('2.3.4');
    expect(result.code.files).toBe(1);
    expect(result.specifications.files).toBe(2);
    expect(result.code.languageBreakdown.javascript).toBe(1);
    expect(result.specifications.languageBreakdown.json).toBe(2);
    expect(result.code.classes).toBe(1);
    expect(result.code.publicMethods).toBe(1);
    expect(result.code.totalFunctions).toBe(1);
    expect(result.code.externalLibrariesAccessed).toBe(2);
    expect(result.code.uniqueExternalLibraries).toBe(2);
    expect(result.code.apiResources.uniqueCount).toBe(1);
    expect(result.code.apiResources.partialCount).toBe(1);
    expect(result.code.apiResources.fullCrudCount).toBe(0);
    expect(result.code.apiResources.readOnlyCount).toBe(0);
  });

  it('ignores files inside ignored directories like node_modules', async () => {
    const repoPath = createRepo();
    writeFile(repoPath, 'src/main.js', [
      'function run() {',
      '  return true;',
      '}'
    ].join('\n'));
    writeFile(repoPath, 'node_modules/fake/index.js', [
      "import express from 'express';",
      'class ShouldBeIgnored {}'
    ].join('\n'));

    const result = await analyzeRepository(repoPath);

    expect(result.code.files).toBe(1);
    expect(result.code.languageBreakdown.javascript).toBe(1);
    expect(result.code.classes).toBe(0);
    expect(result.code.externalLibrariesAccessed).toBe(0);
  });

  it('detects version from pyproject.toml when package.json is absent', async () => {
    const repoPath = createRepo();
    writeFile(repoPath, 'pyproject.toml', [
      '[project]',
      'name = "py-demo"',
      'version = "0.9.1"'
    ].join('\n'));
    writeFile(repoPath, 'app.py', [
      'def run():',
      '    return True'
    ].join('\n'));

    const result = await analyzeRepository(repoPath);

    expect(result.version).toBe('0.9.1');
    expect(result.code.files).toBe(1);
    expect(result.code.languageBreakdown.python).toBe(1);
  });

  it('classifies API resources into full CRUD and read-only categories', async () => {
    const repoPath = createRepo();
    writeFile(repoPath, 'src/books.js', [
      "app.get('/api/books', handler);",
      "app.post('/api/books', handler);",
      "app.put('/api/books/:id', handler);",
      "app.delete('/api/books/:id', handler);"
    ].join('\n'));
    writeFile(repoPath, 'src/health.js', "app.get('/api/health', handler);");

    const result = await analyzeRepository(repoPath);

    expect(result.code.files).toBe(2);
    expect(result.code.apiResources.uniqueCount).toBe(2);
    expect(result.code.apiResources.fullCrudCount).toBe(1);
    expect(result.code.apiResources.readOnlyCount).toBe(1);
    expect(result.code.apiResources.partialCount).toBe(0);
  });

  it('throws clear errors for missing paths and non-directory paths', async () => {
    const repoPath = createRepo();
    const filePath = writeFile(repoPath, 'single-file.js', 'function a() {}');
    const missingPath = path.join(repoPath, 'missing-repo-path');

    await expectAsync(analyzeRepository(missingPath)).toBeRejectedWithError(/Repository path does not exist/);
    await expectAsync(analyzeRepository(filePath)).toBeRejectedWithError(/Path is not a directory/);
  });
});
