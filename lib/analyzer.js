const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { analyzeFile } = require('./file-analyzer');
const { calculateComplexityRating } = require('./complexity');

// File extensions to analyze
const CODE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx'],
  python: ['.py'],
  java: ['.java'],
  csharp: ['.cs'],
  ruby: ['.rb'],
  php: ['.php'],
  go: ['.go'],
  rust: ['.rs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  c: ['.c', '.h'],
  html: ['.html', '.htm'],
  css: ['.css'],
  xml: ['.xml'],
  yaml: ['.yaml', '.yml'],
  json: ['.json']
};

// Directories to ignore
const IGNORE_DIRS = [
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  '.git',
  '.svn',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  'venv',
  'env',
  '.venv',
  'target',
  '.idea',
  '.vscode'
];

/**
 * Detect repository version from common configuration files
 */
function detectVersion(repoPath) {
  try {
    // Check package.json (Node.js/TypeScript)
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, 'utf8');
      const pkg = JSON.parse(content);
      if (pkg.version) return pkg.version;
    }

    // Check pyproject.toml (Python)
    const pyprojPath = path.join(repoPath, 'pyproject.toml');
    if (fs.existsSync(pyprojPath)) {
      const content = fs.readFileSync(pyprojPath, 'utf8');
      const versionMatch = content.match(/version\s*=\s*['"]([\d.]+)['"]/);
      if (versionMatch) return versionMatch[1];
    }

    // Check setup.py (Python)
    const setupPath = path.join(repoPath, 'setup.py');
    if (fs.existsSync(setupPath)) {
      const content = fs.readFileSync(setupPath, 'utf8');
      const versionMatch = content.match(/version\s*=\s*['"]([\d.]+)['"]/);
      if (versionMatch) return versionMatch[1];
    }

    // Check go.mod (Go)
    const goModPath = path.join(repoPath, 'go.mod');
    if (fs.existsSync(goModPath)) {
      const content = fs.readFileSync(goModPath, 'utf8');
      const lines = content.split('\n');
      const moduleLine = lines[0];
      const versionMatch = moduleLine.match(/v(\d+\.\d+\.\d+)/);
      if (versionMatch) return versionMatch[1];
      return 'v0.0.0'; // Default Go version
    }

    // Check Cargo.toml (Rust)
    const cargoPath = path.join(repoPath, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      const content = fs.readFileSync(cargoPath, 'utf8');
      const versionMatch = content.match(/^version\s*=\s*['"]([\d.]+)['"]/m);
      if (versionMatch) return versionMatch[1];
    }

    // Check pom.xml (Java/Maven)
    const pomPath = path.join(repoPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      const content = fs.readFileSync(pomPath, 'utf8');
      const versionMatch = content.match(/<version>([\d.]+)<\/version>/);
      if (versionMatch) return versionMatch[1];
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

async function analyzeRepository(repoPath) {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const stats = fs.statSync(repoPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${repoPath}`);
  }

  // Detect repository version
  const version = detectVersion(repoPath);

  // Find all code files
  const allExtensions = Object.values(CODE_EXTENSIONS).flat();
  const globPattern = `**/*{${allExtensions.join(',')}}`;
  
  const files = await glob(globPattern, {
    cwd: repoPath,
    absolute: true,
    ignore: IGNORE_DIRS.map(dir => `**/${dir}/**`)
  });

  console.log(`Found ${files.length} code files to analyze...`);

  // Initialize aggregated results
  const results = {
    version: version,
    code: {
      linesOfCode: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      classes: 0,
      files: 0,
      publicMethods: 0,
      totalFunctions: 0,
      avgComplexity: 0,
      maxComplexity: 0,
      complexityRating: 'Unknown',
      languageBreakdown: {},
      externalLibrariesAccessed: 0,
      uniqueExternalLibraries: 0
    },
    specifications: {
      linesOfCode: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      files: 0,
      languageBreakdown: {}
    },
    externalLibraries: new Set(),
    complexityScores: []
  };

  // Analyze each file
  for (const filePath of files) {
    try {
      const fileResults = await analyzeFile(filePath, repoPath);
      
      if (fileResults.isSpecification) {
        // Aggregate specification metrics
        results.specifications.linesOfCode += fileResults.linesOfCode;
        results.specifications.codeLines += fileResults.codeLines;
        results.specifications.commentLines += fileResults.commentLines;
        results.specifications.blankLines += fileResults.blankLines;
        results.specifications.files++;
      } else {
        // Aggregate code metrics
        results.code.linesOfCode += fileResults.linesOfCode;
        results.code.codeLines += fileResults.codeLines;
        results.code.commentLines += fileResults.commentLines;
        results.code.blankLines += fileResults.blankLines;
        results.code.classes += fileResults.classes;
        results.code.externalLibrariesAccessed += fileResults.imports;
        results.code.publicMethods += fileResults.publicMethods;
        results.code.totalFunctions += fileResults.functionsCount;
        results.code.files++;
        
        // Track complexity scores (only for code)
        if (fileResults.complexityScores && fileResults.complexityScores.length > 0) {
          results.complexityScores.push(...fileResults.complexityScores);
          const maxScore = Math.max(...fileResults.complexityScores);
          if (maxScore > results.code.maxComplexity) {
            results.code.maxComplexity = maxScore;
          }
        }
      }
      
      // Track external libraries (only from code)
      if (!fileResults.isSpecification) {
        fileResults.externalDependencies.forEach(dep => results.externalLibraries.add(dep));
      }
      
      // Track language breakdown
      const ext = path.extname(filePath);
      const language = getLanguage(ext);
      if (fileResults.isSpecification) {
        results.specifications.languageBreakdown[language] = (results.specifications.languageBreakdown[language] || 0) + fileResults.linesOfCode;
      } else {
        results.code.languageBreakdown[language] = (results.code.languageBreakdown[language] || 0) + fileResults.linesOfCode;
      }
      
    } catch (error) {
      console.warn(`Warning: Could not analyze ${filePath}: ${error.message}`);
    }
  }

  // Calculate derived metrics
  results.code.uniqueExternalLibraries = results.externalLibraries.size;
  
  // Calculate average complexity (only for code)
  if (results.complexityScores.length > 0) {
    const totalComplexity = results.complexityScores.reduce((a, b) => a + b, 0);
    results.code.avgComplexity = totalComplexity / results.complexityScores.length;
  }
  
  // Calculate complexity rating for code
  results.code.complexityRating = calculateComplexityRating(
    results.code.avgComplexity,
    results.code.maxComplexity,
    results.code.linesOfCode,
    results.code.files
  );

  // Prepare legacy flat structure for backward compatibility
  const flatResults = {
    version: results.version,
    linesOfCode: results.code.linesOfCode + results.specifications.linesOfCode,
    codeLines: results.code.codeLines + results.specifications.codeLines,
    commentLines: results.code.commentLines + results.specifications.commentLines,
    blankLines: results.code.blankLines + results.specifications.blankLines,
    classes: results.code.classes,
    classesAndModules: results.code.classes + results.code.files + results.specifications.files,
    externalLibrariesAccessed: results.code.externalLibrariesAccessed,
    uniqueExternalLibraries: results.code.uniqueExternalLibraries,
    publicMethods: results.code.publicMethods,
    complexityRating: results.code.complexityRating,
    avgComplexity: results.code.avgComplexity,
    maxComplexity: results.code.maxComplexity,
    totalFunctions: results.code.totalFunctions,
    filesAnalyzed: results.code.files + results.specifications.files,
    languageBreakdown: { ...results.code.languageBreakdown, ...results.specifications.languageBreakdown },
    // New structure
    code: results.code,
    specifications: results.specifications
  };

  // Clean up Sets for JSON serialization
  delete results.externalLibraries;
  delete results.complexityScores;

  return flatResults;
}

function getLanguage(extension) {
  for (const [language, extensions] of Object.entries(CODE_EXTENSIONS)) {
    if (extensions.includes(extension)) {
      return language;
    }
  }
  return 'other';
}

module.exports = { analyzeRepository };
