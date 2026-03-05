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
      isSpecification: false
    };

    // Determine language and analyze accordingly
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      analyzeJavaScriptTypeScript(content, lines, results);
    } else if (ext === '.py') {
      analyzePython(content, lines, results);
    } else if (ext === '.java') {
      analyzeJava(content, lines, results);
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

  // Count imports
  const importMatches = content.match(/^import\s+[\w.]+;/gm);
  results.imports = importMatches ? importMatches.length : 0;

  // Track dependencies
  const depRegex = /import\s+([\w.]+)/g;
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
