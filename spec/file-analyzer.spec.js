const path = require('path');
const { analyzeFile } = require('../lib/file-analyzer');
const { createTempDir, writeFile, removeDir } = require('./helpers/temp-fs');

describe('file-analyzer analyzeFile', () => {
  const tempDirs = [];

  function createRepo() {
    const repoPath = createTempDir('repo-analyzer-file-spec-');
    tempDirs.push(repoPath);
    return repoPath;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      removeDir(tempDirs.pop());
    }
  });

  it('analyzes JavaScript metrics, dependencies, exports and API resources', () => {
    const repoPath = createRepo();
    const filePath = writeFile(repoPath, 'src/app.js', [
      "import express from 'express';",
      "import localUtil from './local-util';",
      "const lodash = require('lodash');",
      '',
      'class UserService {}',
      '',
      'export function makeUser() {',
      '  return {};',
      '}',
      '',
      'const handler = async () => {',
      '  return true;',
      '};',
      '',
      'const helper = function() {',
      '  return false;',
      '};',
      '',
      'module.exports = { handler };',
      '',
      "app.get('/api/users', handler);",
      "router.post('/api/users', handler);"
    ].join('\n'));

    const result = analyzeFile(filePath, repoPath);

    expect(result.isSpecification).toBeFalse();
    expect(result.classes).toBe(1);
    expect(result.imports).toBe(3);
    expect(result.namedExports).toBe(1);
    expect(result.defaultExports).toBe(1);
    expect(result.publicMethods).toBe(3);
    expect(result.functionsCount).toBe(3);
    expect(result.externalDependencies).toEqual(jasmine.arrayContaining(['express', 'lodash']));
    expect(result.externalDependencies).not.toContain('./local-util');
    expect(result.apiResources.some(resource => resource.name === 'users' && resource.crud.read)).toBeTrue();
    expect(result.apiResources.some(resource => resource.name === 'users' && resource.crud.create)).toBeTrue();
  });

  it('analyzes Python imports, public methods and API resources', () => {
    const repoPath = createRepo();
    const filePath = writeFile(repoPath, 'service/api.py', [
      'import os, requests',
      'from flask import Flask',
      '',
      'class UserViewSet(ViewSet):',
      '    pass',
      '',
      'def public_fn():',
      '    return 1',
      '',
      'def _private_fn():',
      '    return 0',
      '',
      "@api_view(['GET', 'PATCH'])",
      'def list_orders(request):',
      '    return Response({})',
      '',
      'urlpatterns = [',
      "    path('api/v1/users/<int:pk>', user_detail),",
      ']'
    ].join('\n'));

    const result = analyzeFile(filePath, repoPath);

    expect(result.isSpecification).toBeFalse();
    expect(result.classes).toBe(1);
    expect(result.imports).toBe(2);
    expect(result.publicMethods).toBe(2);
    expect(result.functionsCount).toBe(2);
    expect(result.externalDependencies).toEqual(jasmine.arrayContaining(['os', 'requests', 'flask']));

    const usersViewset = result.apiResources.find(resource => resource.name === 'users' && resource.type === 'viewset');
    expect(usersViewset).toBeDefined();
    expect(usersViewset.crud).toEqual({ create: true, read: true, update: true, delete: true });

    const ordersApiView = result.apiResources.find(resource => resource.name === 'orders' && resource.type === 'api_view');
    expect(ordersApiView).toBeDefined();
    expect(ordersApiView.crud.create).toBeFalse();
    expect(ordersApiView.crud.read).toBeTrue();
    expect(ordersApiView.crud.update).toBeTrue();
    expect(ordersApiView.crud.delete).toBeFalse();
  });

  it('uses go.mod module path to separate external and internal imports', () => {
    const repoPath = createRepo();
    writeFile(repoPath, 'go.mod', ['module example.com/myapp', '', 'go 1.22'].join('\n'));

    const filePath = writeFile(repoPath, 'cmd/server/main.go', [
      'package main',
      '',
      'import (',
      '  "fmt"',
      '  "github.com/go-chi/chi/v5"',
      '  "example.com/myapp/internal/service"',
      ')',
      '',
      'type User struct {',
      '  ID int',
      '}',
      '',
      'func Exported() {}',
      '',
      'func routes(r chi.Router) {',
      '  r.Get("/v1/contracts", handler)',
      '  r.Post("/v1/contracts", handler)',
      '}'
    ].join('\n'));

    const result = analyzeFile(filePath, repoPath);

    expect(result.isSpecification).toBeFalse();
    expect(result.classes).toBe(1);
    expect(result.imports).toBe(3);
    expect(result.publicMethods).toBe(1);
    expect(result.functionsCount).toBe(1);
    expect(result.externalDependencies).toEqual(['github.com/go-chi/chi/v5']);
    expect(result.apiResources.some(resource => resource.name === 'contracts' && resource.crud.read)).toBeTrue();
    expect(result.apiResources.some(resource => resource.name === 'contracts' && resource.crud.create)).toBeTrue();
  });

  it('marks YAML files as specifications and keeps code metrics at zero', () => {
    const repoPath = createRepo();
    const filePath = writeFile(repoPath, 'config/app.yaml', [
      'app:',
      '  name: sample',
      '  env: test'
    ].join('\n'));

    const result = analyzeFile(filePath, repoPath);

    expect(result.isSpecification).toBeTrue();
    expect(result.classes).toBe(0);
    expect(result.imports).toBe(0);
    expect(result.publicMethods).toBe(0);
    expect(result.functionsCount).toBe(0);
    expect(result.apiResources.length).toBe(0);
  });

  it('wraps file read errors with file path context', () => {
    const repoPath = createRepo();
    const missingPath = path.join(repoPath, 'does-not-exist.js');

    expect(() => analyzeFile(missingPath, repoPath)).toThrowError(/Error analyzing .*does-not-exist\.js/);
  });
});
