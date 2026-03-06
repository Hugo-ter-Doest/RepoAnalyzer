const fs = require('fs');
const path = require('path');
const { analyzeComplexity } = require('./complexity');

const goModulePathCache = new Map();

function analyzeFile(filePath, repoPath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = path.extname(filePath);
    
    const results = {
      linesOfCode: lines.length,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      classes: 0,
      imports: 0,
      namedExports: 0,
      defaultExports: 0,
      publicMethods: 0,
      externalDependencies: [],
      complexityScores: [],
      functionsCount: 0,
      maxComplexityFunction: null,
      isSpecification: false,
      apiResources: []  // Track unique API resources
    };

    // Determine language and analyze accordingly
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      analyzeJavaScriptTypeScript(content, lines, results);
    } else if (ext === '.py') {
      analyzePython(content, lines, results);
    } else if (ext === '.java') {
      analyzeJava(content, lines, results);
    } else if (['.kt', '.kts'].includes(ext)) {
      analyzeKotlin(content, lines, results);
    } else if (ext === '.cs') {
      analyzeCSharp(content, lines, results);
    } else if (['.cpp', '.cc', '.cxx', '.hpp', '.h', '.c'].includes(ext)) {
      analyzeCppC(content, lines, results);
    } else if (ext === '.go') {
      const goModulePath = getGoModulePath(repoPath);
      analyzeGo(content, lines, results, goModulePath);
    } else if (ext === '.rb') {
      analyzeRuby(content, lines, results);
    } else if (ext === '.php') {
      analyzePHP(content, lines, results);
    } else if (ext === '.rs') {
      analyzeRust(content, lines, results);
    } else if (['.html', '.htm'].includes(ext)) {
      analyzeHTML(content, lines, results);
      results.isSpecification = true;
    } else if (ext === '.css') {
      analyzeCSS(content, lines, results);
      results.isSpecification = true;
    } else if (ext === '.xml') {
      analyzeXML(content, lines, results);
      results.isSpecification = true;
    } else if (['.json'].includes(ext)) {
      analyzeJSON(content, lines, results);
      results.isSpecification = true;
    } else if (['.yaml', '.yml'].includes(ext)) {
      analyzeYAML(content, lines, results);
      results.isSpecification = true;
    }

    // Only analyze complexity for code files, not specifications
    if (!results.isSpecification) {
      const complexityResults = analyzeComplexity(content, ext);
      results.complexityScores = complexityResults.scores;
      results.functionsCount = complexityResults.functionsCount;
      results.maxComplexityFunction = complexityResults.maxComplexityFunction || null;
    }

    return results;
  } catch (error) {
    throw new Error(`Error analyzing ${filePath}: ${error.message}`);
  }
}

function analyzeJavaScriptTypeScript(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank lines
    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    // Block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Single line comments
    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    // Code lines
    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/\bclass\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count imports and dependencies
  // Match ES6 imports: import ... from 'package'
  const es6ImportRegex = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    results.imports++;
    const dep = match[1];
    if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
      const packageName = dep.split('/')[0];
      if (packageName && results.externalDependencies) {
        results.externalDependencies.push(packageName);
      }
    }
  }
  
  // Match require statements: require('package')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    results.imports++;
    const dep = match[1];
    if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
      const packageName = dep.split('/')[0];
      if (packageName && results.externalDependencies) {
        results.externalDependencies.push(packageName);
      }
    }
  }

  // Count exports
  const namedExportMatches = content.match(/export\s+(?:const|let|var|function|class|interface|type|enum)\s+\w+/g);
  const exportListMatches = content.match(/export\s*{[^}]+}/g);
  results.namedExports = (namedExportMatches ? namedExportMatches.length : 0) +
                          (exportListMatches ? exportListMatches.length : 0);
  
  const defaultExportMatches = content.match(/export\s+default\s+/g);
  results.defaultExports = defaultExportMatches ? defaultExportMatches.length : 0;

  // Count module.exports
  const moduleExportsMatches = content.match(/module\.exports\s*=/g);
  if (moduleExportsMatches) {
    results.defaultExports += moduleExportsMatches.length;
  }

  // Count public methods (all function types with block bodies)
  const functionPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{/g,  // function declarations
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*{/g,  // arrow functions with block
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*{/g  // function expressions
  ];
  
  let functionCount = 0;
  for (const pattern of functionPatterns) {
    const matches = content.match(pattern);
    if (matches) functionCount += matches.length;
  }
  results.publicMethods = functionCount;
  
  // Detect CRUD API endpoints
  detectJavaScriptAPIs(content, results);
}

function detectJavaScriptAPIs(content, results) {
  // Express/Koa route patterns: app.get('/api/users', ...), router.post('/products/:id', ...)
  const routePattern = /\b(?:app|router|api)\.(get|post|put|patch|delete)\s*\(\s*['"]([\w\/:]+)['"]/g;
  let match;
  
  while ((match = routePattern.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    const path = match[2];
    const resourceName = extractResourceFromPath(path);
    
    if (resourceName) {
      results.apiResources.push({
        name: resourceName,
        type: 'route',
        crud: {
          create: method === 'post',
          read: method === 'get',
          update: method === 'put' || method === 'patch',
          delete: method === 'delete'
        }
      });
    }
  }
  
  // RESTful method handlers in objects/classes
  const restMethods = content.match(/\b(get|post|put|patch|delete):\s*(?:async\s+)?function/gi);
  if (restMethods) {
    restMethods.forEach(method => {
      const methodType = method.match(/\b(get|post|put|patch|delete)/i)[1].toLowerCase();
      // Try to infer resource from surrounding context - use generic 'resource' if unclear
      results.apiResources.push({
        name: 'resource',
        type: 'method',
        crud: {
          create: methodType === 'post',
          read: methodType === 'get',
          update: methodType === 'put' || methodType === 'patch',
          delete: methodType === 'delete'
        }
      });
    });
  }
}

function analyzePython(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    // Docstrings/block comments
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      const delimiter = trimmed.startsWith('"""') ? '"""' : "'''";
      results.commentLines++;
      
      if (trimmed.split(delimiter).length - 1 >= 2) {
        // Single line docstring
        continue;
      }
      
      inBlockComment = !inBlockComment;
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      continue;
    }

    if (trimmed.startsWith('#')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/^class\s+\w+/gm);
  results.classes = classMatches ? classMatches.length : 0;

  // Count imports
  const importMatches = content.match(/^(?:import|from)\s+[\w.]+/gm);
  results.imports = importMatches ? importMatches.length : 0;

  // Track dependencies - handle comma-separated imports
  const importLines = content.match(/^(?:from|import)\s+.+$/gm) || [];
  for (const line of importLines) {
    if (line.startsWith('from ')) {
      // from package import ... - only count the package
      const match = line.match(/^from\s+([\w.]+)/);
      if (match) {
        const dep = match[1];
        if (!dep.startsWith('.')) {
          const packageName = dep.split('.')[0];
          if (packageName && results.externalDependencies) {
            results.externalDependencies.push(packageName);
          }
        }
      }
    } else if (line.startsWith('import ')) {
      // import pkg1, pkg2, pkg3 - split on commas to count each
      const importsStr = line.substring(7).trim(); // Remove 'import '
      const packages = importsStr.split(',').map(p => p.trim());
      for (const pkg of packages) {
        const packageName = pkg.split('.')[0];
        if (packageName && results.externalDependencies) {
          results.externalDependencies.push(packageName);
        }
      }
    }
  }

  // Count public functions (not starting with _, matching full function signature)
  const functionMatches = content.match(/^\s*def\s+(?!_)\w+\s*\([^)]*\):/gm);
  results.publicMethods = functionMatches ? functionMatches.length : 0;
  
  // Detect CRUD API endpoints
  detectPythonAPIs(content, results);
}

function detectPythonAPIs(content, results) {
  // ViewSet classes typically provide full CRUD
  const viewSetMatches = content.match(/class\s+(\w+).*ViewSet/g);
  if (viewSetMatches) {
    viewSetMatches.forEach(match => {
      // Extract resource name from class name (e.g., UserViewSet -> users)
      const className = match.match(/class\s+(\w+)/)[1];
      const resourceName = extractResourceFromClassName(className);
      
      results.apiResources.push({
        name: resourceName,
        type: 'viewset',
        crud: { create: true, read: true, update: true, delete: true }
      });
    });
  }
  
  // Django path/url patterns with resource paths
  const pathMatches = content.match(/(?:path|url|re_path)\(['"]([\w/<>:-]+)['"]/g);
  if (pathMatches) {
    pathMatches.forEach(match => {
      const pathMatch = match.match(/['"]([\w/<>:-]+)['"]/);
      if (pathMatch) {
        const path = pathMatch[1];
        const resourceName = extractResourceFromPath(path);
        if (resourceName) {
          results.apiResources.push({
            name: resourceName,
            type: 'path',
            crud: { create: false, read: true, update: false, delete: false }
          });
        }
      }
    });
  }
  
  // @api_view decorator - try to infer resource from context
  const apiViewMatches = content.match(/@api_view\(\[([^\]]+)\]\)[^{]*?def\s+(\w+)/g);
  if (apiViewMatches) {
    apiViewMatches.forEach(match => {
      const methodsMatch = match.match(/@api_view\(\[([^\]]+)\]\)/);
      const funcMatch = match.match(/def\s+(\w+)/);
      
      if (funcMatch) {
        const funcName = funcMatch[1];
        const resourceName = extractResourceFromFunctionName(funcName);
        const methods = methodsMatch ? methodsMatch[1].toLowerCase() : '';
        
        results.apiResources.push({
          name: resourceName,
          type: 'api_view',
          crud: {
            create: methods.includes('post'),
            read: methods.includes('get'),
            update: methods.includes('put') || methods.includes('patch'),
            delete: methods.includes('delete')
          }
        });
      }
    });
  }
}

function extractResourceFromClassName(className) {
  // UserViewSet -> users, ProductViewSet -> products
  let resource = className.replace(/ViewSet|View|API|Serializer$/i, '');
  return pluralize(resource).toLowerCase();
}

function extractResourceFromPath(path) {
  // Extract the main resource from paths like:
  // - 'api/v1/users/<int:pk>' -> 'users'
  // - '/v1/contracts/{hash}/accept' -> 'contracts'
  // - options.BaseURL+"/v1/services" -> 'services' (after literal extraction)
  if (!path || typeof path !== 'string') {
    return null;
  }

  let cleaned = path.trim();

  if (!cleaned) {
    return null;
  }

  // Ignore full URLs (these are usually callbacks or external URLs, not API resources)
  if (/^https?:\/\//i.test(cleaned)) {
    return null;
  }

  // Remove query/hash parts
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Remove wrapping quotes if present
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');

  // Normalize slashes and remove leading slash
  cleaned = cleaned.replace(/^\/+/, '');

  const segments = cleaned
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !s.startsWith(':'))
    .filter(s => !(/^<.+>$/.test(s) || /^\{.+\}$/.test(s)));

  if (segments.length === 0) {
    return null;
  }

  // Skip common API prefixes and version segments
  const prefixPattern = /^(api|rest|internal|public|v\d+)$/i;
  let index = 0;
  while (index < segments.length && prefixPattern.test(segments[index])) {
    index++;
  }

  if (index >= segments.length) {
    return null;
  }

  let resource = segments[index].toLowerCase();

  // Skip hidden/special segments like .well-known
  if (resource.startsWith('.')) {
    const nextSegment = segments[index + 1];
    resource = nextSegment ? nextSegment.toLowerCase() : '';
  }

  if (!resource) {
    return null;
  }

  // For file-like segments, use name part only (e.g. jwks.json -> jwks)
  resource = resource.replace(/\.[a-z0-9]+$/i, '');

  return resource || null;
}

function extractPathLiteralFromExpression(expression, requirePathLike = false) {
  if (!expression || typeof expression !== 'string') {
    return null;
  }

  const matches = [...expression.matchAll(/["'`]([^"'`]+)["'`]/g)].map(match => match[1]);
  if (matches.length === 0) {
    return null;
  }

  // Prefer path-like literals first
  const pathLike = matches.find(value => value.includes('/'));
  if (pathLike) {
    return pathLike;
  }

  if (requirePathLike) {
    return null;
  }

  return matches[0];
}

function extractResourceFromFunctionName(funcName) {
  // create_user -> user, get_products -> products, list_orders -> orders
  let resource = funcName.replace(/^(get|post|put|patch|delete|create|update|list|retrieve|destroy)_?/i, '');
  return resource || funcName;
}

function pluralize(word) {
  // Simple pluralization - good enough for most API resource names
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  } else if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + 'ies';
  } else if (!word.endsWith('s')) {
    return word + 's';
  }
  return word;
}

function analyzeJava(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/\b(?:public|private|protected)?\s*class\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count imports (including static and wildcard imports)
  const importMatches = content.match(/^import\s+(?:static\s+)?[\w.*]+;/gm);
  results.imports = importMatches ? importMatches.length : 0;

  // Track dependencies (extract package names, handling static imports)
  const depRegex = /import\s+(?:static\s+)?([\w.]+)(?:\.\*)?/g;
  let match;
  while ((match = depRegex.exec(content)) !== null) {
    if (match[1]) {
      const packageName = match[1].split('.')[0];
      if (packageName && results.externalDependencies) {
        results.externalDependencies.push(packageName);
      }
    }
  }

  // Count public methods
  const methodMatches = content.match(/\bpublic\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\(/g);
  results.publicMethods = methodMatches ? methodMatches.length : 0;
  
  // Detect Spring Boot API endpoints
  detectJavaAPIs(content, results);
}

function analyzeKotlin(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes (including data classes, sealed classes, object declarations)
  const classMatches = content.match(/\b(?:public|private|protected|internal)?\s*(?:open|abstract|sealed|data)?\s*(?:class|object|interface)\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count imports
  const importMatches = content.match(/^import\s+[\w.*]+/gm);
  results.imports = importMatches ? importMatches.length : 0;

  // Track dependencies (extract package names)
  const depRegex = /import\s+([\w.]+)(?:\.\*)?/g;
  let match;
  while ((match = depRegex.exec(content)) !== null) {
    if (match[1]) {
      const packageName = match[1].split('.')[0];
      if (packageName && results.externalDependencies) {
        results.externalDependencies.push(packageName);
      }
    }
  }

  // Count public functions/methods
  const methodMatches = content.match(/\b(?:public|open)?\s*fun\s+\w+\s*\(/g);
  results.publicMethods = methodMatches ? methodMatches.length : 0;
  
  // Detect Spring Boot API endpoints
  detectKotlinAPIs(content, results);
}

function analyzeCSharp(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/\b(?:public|private|protected|internal)?\s*class\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count using statements
  const usingMatches = content.match(/^using\s+[\w.]+;/gm);
  results.imports = usingMatches ? usingMatches.length : 0;

  // Track dependencies
  const depRegex = /using\s+([\w.]+)/g;
  let match;
  while ((match = depRegex.exec(content)) !== null) {
    if (match[1]) {
      const packageName = match[1].split('.')[0];
      if (packageName && results.externalDependencies) {
        results.externalDependencies.push(packageName);
      }
    }
  }

  // Count public methods
  const methodMatches = content.match(/\bpublic\s+(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\(/g);
  results.publicMethods = methodMatches ? methodMatches.length : 0;
}

function analyzeCppC(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/\bclass\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count includes
  const includeMatches = content.match(/#include\s*[<"][^>"]+[>"]/g);
  results.imports = includeMatches ? includeMatches.length : 0;

  // Count function declarations
  const functionMatches = content.match(/\b(?:public:|extern\s+)?(?:\w+(?:\s*\*)?)\s+\w+\s*\([^)]*\)\s*[{;]/g);
  results.publicMethods = functionMatches ? Math.min(functionMatches.length, 100) : 0;
}

function analyzeGo(content, lines, results, goModulePath = null) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count structs (Go's equivalent of classes)
  const structMatches = content.match(/\btype\s+\w+\s+struct\s*{/g);
  results.classes = structMatches ? structMatches.length : 0;

  // Count imports (supports both single imports and grouped import blocks)
  const importPaths = [];

  const singleImportRegex = /^import\s+(?:[\w.]+\s+)?["`]([^"`]+)["`]/gm;
  let singleMatch;
  while ((singleMatch = singleImportRegex.exec(content)) !== null) {
    if (singleMatch[1]) {
      importPaths.push(singleMatch[1]);
    }
  }

  const groupedImportRegex = /^import\s*\(([\s\S]*?)\)/gm;
  let blockMatch;
  while ((blockMatch = groupedImportRegex.exec(content)) !== null) {
    const blockLines = blockMatch[1].split('\n');
    for (const blockLine of blockLines) {
      const trimmedLine = blockLine.replace(/\/\/.*$/, '').trim();
      if (!trimmedLine) {
        continue;
      }

      const pathMatch = trimmedLine.match(/^(?:[\w.]+\s+)?["`]([^"`]+)["`]/);
      if (pathMatch && pathMatch[1]) {
        importPaths.push(pathMatch[1]);
      }
    }
  }

  results.imports = importPaths.length;

  const externalGoImports = importPaths.filter(importPath => isExternalGoImport(importPath, goModulePath));
  if (results.externalDependencies) {
    results.externalDependencies.push(...externalGoImports);
  }

  // Count exported functions (starting with capital letter)
  const functionMatches = content.match(/^func\s+[A-Z]\w+/gm);
  results.publicMethods = functionMatches ? functionMatches.length : 0;
  
  // Detect CRUD API endpoints
  detectGoAPIs(content, results);
}

function detectGoAPIs(content, results) {
  const addResource = (resourceName, type, method = null) => {
    if (!resourceName) {
      return;
    }

    const normalizedMethod = method ? method.toUpperCase() : null;
    results.apiResources.push({
      name: resourceName,
      type,
      crud: {
        create: normalizedMethod === 'POST',
        read: normalizedMethod === null || normalizedMethod === 'GET',
        update: normalizedMethod === 'PUT' || normalizedMethod === 'PATCH',
        delete: normalizedMethod === 'DELETE'
      }
    });
  };

  // 1) net/http and gorilla handlers:
  //    - http.HandleFunc("/health", ...)
  //    - mux.Handle("/metrics", ...)
  //    - r.HandleFunc("/api/users", ...).Methods("GET")
  const genericHandlerPattern = /\.(HandleFunc|Handle)\s*\(\s*([^,]+),/g;
  let match;

  while ((match = genericHandlerPattern.exec(content)) !== null) {
    const pathLiteral = extractPathLiteralFromExpression(match[2], true);
    const resourceName = extractResourceFromPath(pathLiteral || '');
    addResource(resourceName, 'handler');
  }

  // 2) gorilla style method chaining:
  //    - r.HandleFunc("/v1/contracts", h).Methods("POST")
  //    - r.Handle("/v1/x", h).Methods("GET")
  const chainedMethodPattern = /\.(?:HandleFunc|Handle)\s*\(\s*([^,]+),[^\)]*\)\s*\.Methods\s*\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']/g;

  while ((match = chainedMethodPattern.exec(content)) !== null) {
    const pathLiteral = extractPathLiteralFromExpression(match[1], true);
    const method = match[2];
    const resourceName = extractResourceFromPath(pathLiteral || '');
    addResource(resourceName, 'route', method);
  }

  // 3) chi router style:
  //    - r.Get("/v1/contracts", ...)
  //    - r.Post(options.BaseURL+"/v1/token", ...)
  //    - r.Put(options.BaseURL+"/v1/contracts/{hash}/accept", ...)
  const chiMethodPattern = /\.(Get|Post|Put|Patch|Delete)\s*\(\s*([^,]+),/g;

  while ((match = chiMethodPattern.exec(content)) !== null) {
    const method = match[1];
    const pathLiteral = extractPathLiteralFromExpression(match[2], true);
    const resourceName = extractResourceFromPath(pathLiteral || '');
    addResource(resourceName, 'chi-route', method);
  }

  // 4) gorilla path/method split definitions:
  //    - r.Path("/v1/contracts").Methods("GET")
  const pathThenMethodPattern = /\.Path\s*\(\s*([^\)]+)\)\s*\.Methods\s*\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']/g;

  while ((match = pathThenMethodPattern.exec(content)) !== null) {
    const pathLiteral = extractPathLiteralFromExpression(match[1], true);
    const method = match[2];
    const resourceName = extractResourceFromPath(pathLiteral || '');
    addResource(resourceName, 'path-method', method);
  }
}

function getGoModulePath(repoPath) {
  if (goModulePathCache.has(repoPath)) {
    return goModulePathCache.get(repoPath);
  }

  let modulePath = null;
  try {
    const goModPath = path.join(repoPath, 'go.mod');
    if (fs.existsSync(goModPath)) {
      const goModContent = fs.readFileSync(goModPath, 'utf-8');
      const moduleMatch = goModContent.match(/^\s*module\s+([^\s]+)\s*$/m);
      if (moduleMatch && moduleMatch[1]) {
        modulePath = moduleMatch[1].trim();
      }
    }
  } catch (error) {
    modulePath = null;
  }

  goModulePathCache.set(repoPath, modulePath);
  return modulePath;
}

function isExternalGoImport(importPath, goModulePath) {
  if (!importPath) {
    return false;
  }

  if (!importPath.includes('/')) {
    return false;
  }

  if (goModulePath && (importPath === goModulePath || importPath.startsWith(`${goModulePath}/`))) {
    return false;
  }

  return true;
}

function analyzeRuby(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('=begin')) {
      inBlockComment = true;
      results.commentLines++;
      continue;
    }

    if (trimmed.startsWith('=end')) {
      inBlockComment = false;
      results.commentLines++;
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      continue;
    }

    if (trimmed.startsWith('#')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes and modules
  const classMatches = content.match(/^class\s+\w+/gm);
  results.classes = classMatches ? classMatches.length : 0;

  // Count requires
  const requireMatches = content.match(/^require\s+['"][^'"]+['"]/gm);
  results.imports = requireMatches ? requireMatches.length : 0;

  // Count public methods (def without 'private' before)
  const methodMatches = content.match(/^\s*def\s+\w+/gm);
  results.publicMethods = methodMatches ? methodMatches.length : 0;
}

function analyzePHP(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count classes
  const classMatches = content.match(/\bclass\s+\w+/g);
  results.classes = classMatches ? classMatches.length : 0;

  // Count includes/requires
  const includeMatches = content.match(/\b(?:require|include|require_once|include_once)\s*\(?['"][^'"]+['"]\)?/g);
  results.imports = includeMatches ? includeMatches.length : 0;

  // Count public methods
  const methodMatches = content.match(/\bpublic\s+function\s+\w+/g);
  results.publicMethods = methodMatches ? methodMatches.length : 0;

  // Detect CRUD API endpoints (Laravel routes)
  detectPHPAPIs(content, results);
}

function analyzeRust(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }

  // Count structs and enums
  const structMatches = content.match(/\b(?:pub\s+)?(?:struct|enum)\s+\w+/g);
  results.classes = structMatches ? structMatches.length : 0;

  // Count use statements
  const useMatches = content.match(/^use\s+[\w:]+/gm);
  results.imports = useMatches ? useMatches.length : 0;

  // Count public functions
  const functionMatches = content.match(/\bpub\s+(?:async\s+)?fn\s+\w+/g);
  results.publicMethods = functionMatches ? functionMatches.length : 0;
}

function detectJavaAPIs(content, results) {
  // Check if file contains @RestController or @Controller
  const hasRestController = /@RestController/.test(content) || (/@Controller/.test(content) && /@ResponseBody/.test(content));
  
  if (!hasRestController) {
    return; // Not a REST controller
  }
  
  // Extract base path from @RequestMapping at class level
  let basePath = '';
  const classRequestMapping = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:-]+)["']/;
  const baseMatch = content.match(classRequestMapping);
  if (baseMatch) {
    basePath = baseMatch[1];
  }
  
  // Detect individual endpoint mappings: @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping
  const mappingPatterns = [
    { regex: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:{}-]+)["']/g, method: 'GET' },
    { regex: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:{}-]+)["']/g, method: 'POST' },
    { regex: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:{}-]+)["']/g, method: 'PUT' },
    { regex: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:{}-]+)["']/g, method: 'PATCH' },
    { regex: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([\\w\\/:{}-]+)["']/g, method: 'DELETE' },
    // @RequestMapping with method specified
    { regex: /@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.GET[^)]*value\s*=\s*["']([\\w\\/:{}-]+)["']/g, method: 'GET' },
    { regex: /@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.POST[^)]*value\s*=\s*["']([\\w\\/:{}-]+)["']/g, method: 'POST' },
    { regex: /@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.PUT[^)]*value\s*=\s*["']([\\w\\/:{}-]+)["']/g, method: 'PUT' },
    { regex: /@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.DELETE[^)]*value\s*=\s*["']([\\w\\/:{}-]+)["']/g, method: 'DELETE' }
  ];
  
  // Track resources by name to aggregate CRUD operations
  const resourceMap = {};
  
  mappingPatterns.forEach(({ regex, method }) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];
      const fullPath = basePath + path;
      
      // Extract resource name from path
      const resourceMatch = fullPath.match(/\/(?:api\/)?(?:v\d+\/)?(\w+)/);
      if (resourceMatch) {
        const resourceName = resourceMatch[1];
        
        // Initialize resource entry if needed
        if (!resourceMap[resourceName]) {
          resourceMap[resourceName] = {
            name: resourceName,
            crud: { create: false, read: false, update: false, delete: false }
          };
        }
        
        // Map HTTP methods to CRUD operations
        if (method === 'GET') resourceMap[resourceName].crud.read = true;
        if (method === 'POST') resourceMap[resourceName].crud.create = true;
        if (method === 'PUT' || method === 'PATCH') resourceMap[resourceName].crud.update = true;
        if (method === 'DELETE') resourceMap[resourceName].crud.delete = true;
      }
    }
  });
  
  // Convert resourceMap to array and add to results
  results.apiResources = Object.values(resourceMap);
}

function detectKotlinAPIs(content, results) {
  // Check if file contains @RestController or @Controller
  const hasRestController = /@RestController/.test(content) || (/@Controller/.test(content) && /@ResponseBody/.test(content));
  
  if (!hasRestController) {
    return; // Not a REST controller
  }
  
  // Extract base path from @RequestMapping at class level
  let basePath = '';
  const classRequestMapping = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:-]+)["']/;
  const baseMatch = content.match(classRequestMapping);
  if (baseMatch) {
    basePath = baseMatch[1];
  }
  
  // Detect individual endpoint mappings: @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping
  const mappingPatterns = [
    { regex: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:{}-]+)["']/g, method: 'GET' },
    { regex: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:{}-]+)["']/g, method: 'POST' },
    { regex: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:{}-]+)["']/g, method: 'PUT' },
    { regex: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:{}-]+)["']/g, method: 'PATCH' },
    { regex: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([\w\\/:{}-]+)["']/g, method: 'DELETE' }
  ];
  
  // Track resources by name to aggregate CRUD operations
  const resourceMap = {};
  
  mappingPatterns.forEach(({ regex, method }) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];
      const fullPath = basePath + path;
      
      // Extract resource name from path
      const resourceMatch = fullPath.match(/\/(?:api\/)?(?:v\d+\/)?(\w+)/);
      if (resourceMatch) {
        const resourceName = resourceMatch[1];
        
        // Initialize resource entry if needed
        if (!resourceMap[resourceName]) {
          resourceMap[resourceName] = {
            name: resourceName,
            crud: { create: false, read: false, update: false, delete: false }
          };
        }
        
        // Map HTTP methods to CRUD operations
        if (method === 'GET') resourceMap[resourceName].crud.read = true;
        if (method === 'POST') resourceMap[resourceName].crud.create = true;
        if (method === 'PUT' || method === 'PATCH') resourceMap[resourceName].crud.update = true;
        if (method === 'DELETE') resourceMap[resourceName].crud.delete = true;
      }
    }
  });
  
  // Convert resourceMap to array and add to results
  results.apiResources = Object.values(resourceMap);
}

function detectPHPAPIs(content, results) {
  // Laravel route patterns: Route::get('/path', ...), Route::post('/path', ...), etc.
  // Also detect Route::resource('name', ...) for full CRUD

  // Single HTTP method routes
  const routePattern = /Route::(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,/gi;
  let match;

  // Track Route::resource() declarations for full CRUD
  const resourcePattern = /Route::resource\s*\(\s*['"]([^'"]+)['"]\s*,/gi;
  const resourceMatches = [...content.matchAll(resourcePattern)];
  
  while ((match = routePattern.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    const path = match[2];
    const resourceName = extractResourceFromPath(path);

    if (resourceName) {
      const existingResource = results.apiResources.find(r => r.name === resourceName);
      if (existingResource) {
        if (method === 'post') existingResource.crud.create = true;
        else if (method === 'get') existingResource.crud.read = true;
        else if (method === 'put' || method === 'patch') existingResource.crud.update = true;
        else if (method === 'delete') existingResource.crud.delete = true;
      } else {
        results.apiResources.push({
          name: resourceName,
          type: 'Laravel Route',
          crud: {
            create: method === 'post',
            read: method === 'get',
            update: method === 'put' || method === 'patch',
            delete: method === 'delete'
          }
        });
      }
    }
  }

  // Handle Route::resource() - automatically creates all CRUD operations
  for (const resourceMatch of resourceMatches) {
    const resourceName = resourceMatch[1];
    const normalizedName = resourceName.replace(/[-_]/g, '').toLowerCase();
    
    const existingResource = results.apiResources.find(r => r.name.replace(/[-_]/g, '').toLowerCase() === normalizedName);
    if (!existingResource) {
      results.apiResources.push({
        name: resourceName,
        type: 'Laravel Resource',
        crud: {
          create: true,
          read: true,
          update: true,
          delete: true
        }
      });
    } else {
      // Mark all CRUD operations for existing resource
      existingResource.crud.create = true;
      existingResource.crud.read = true;
      existingResource.crud.update = true;
      existingResource.crud.delete = true;
    }
  }

  // Symfony attribute routes: #[Route('/path', methods: ['GET'])] or #[Get('/path')]
  // Detect #[Get|Post|Put|Patch|Delete('/path')]
  const symfonyShorthandPattern = /#\[(Get|Post|Put|Patch|Delete)\s*\(\s*['"]([^'"]+)['"]/gi;
  while ((match = symfonyShorthandPattern.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    const path = match[2];
    const resourceName = extractResourceFromPath(path);

    if (resourceName) {
      const existingResource = results.apiResources.find(r => r.name === resourceName);
      if (existingResource) {
        if (method === 'post') existingResource.crud.create = true;
        else if (method === 'get') existingResource.crud.read = true;
        else if (method === 'put' || method === 'patch') existingResource.crud.update = true;
        else if (method === 'delete') existingResource.crud.delete = true;
      } else {
        results.apiResources.push({
          name: resourceName,
          type: 'Symfony Route',
          crud: {
            create: method === 'post',
            read: method === 'get',
            update: method === 'put' || method === 'patch',
            delete: method === 'delete'
          }
        });
      }
    }
  }

  // Symfony generic Route attribute: #[Route('/path', methods: ['GET', 'POST'])]
  const symfonyRoutePattern = /#\[Route\s*\(\s*['"]([^'"]+)['"][^)]*methods\s*:\s*\[([^\]]+)\]/gi;
  while ((match = symfonyRoutePattern.exec(content)) !== null) {
    const path = match[1];
    const methodsStr = match[2];
    const resourceName = extractResourceFromPath(path);

    if (resourceName) {
      const existingResource = results.apiResources.find(r => r.name === resourceName);
      const methods = methodsStr.match(/['"](\w+)['"]/g) || [];
      const methodList = methods.map(m => m.replace(/['\"]/g, '').toUpperCase());

      if (existingResource) {
        if (methodList.includes('POST')) existingResource.crud.create = true;
        if (methodList.includes('GET')) existingResource.crud.read = true;
        if (methodList.includes('PUT') || methodList.includes('PATCH')) existingResource.crud.update = true;
        if (methodList.includes('DELETE')) existingResource.crud.delete = true;
      } else {
        results.apiResources.push({
          name: resourceName,
          type: 'Symfony Route',
          crud: {
            create: methodList.includes('POST'),
            read: methodList.includes('GET'),
            update: methodList.includes('PUT') || methodList.includes('PATCH'),
            delete: methodList.includes('DELETE')
          }
        });
      }
    }
  }
}

function analyzeHTML(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.includes('<!--')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('-->')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('-->')) {
        inBlockComment = false;
      }
      continue;
    }

    results.codeLines++;
  }
}

function analyzeCSS(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.includes('/*')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    results.codeLines++;
  }
}

function analyzeXML(content, lines, results) {
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.includes('<!--')) {
      inBlockComment = true;
      results.commentLines++;
      if (trimmed.includes('-->')) {
        inBlockComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      results.commentLines++;
      if (trimmed.includes('-->')) {
        inBlockComment = false;
      }
      continue;
    }

    results.codeLines++;
  }
}

function analyzeJSON(content, lines, results) {
  // JSON doesn't have comments in standard format, all non-blank lines are code
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    results.codeLines++;
  }
}

function analyzeYAML(content, lines, results) {
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      results.blankLines++;
      continue;
    }

    if (trimmed.startsWith('#')) {
      results.commentLines++;
      continue;
    }

    results.codeLines++;
  }
}

module.exports = { analyzeFile };
