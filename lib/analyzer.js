const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { analyzeFile } = require('./file-analyzer');

// File extensions to analyze
const CODE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx'],
  python: ['.py'],
  java: ['.java'],
  kotlin: ['.kt', '.kts'],
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
      classes: 0,
      files: 0,
      publicMethods: 0,
      totalFunctions: 0,
      languageBreakdown: {},
      externalLibrariesAccessed: 0,
      uniqueExternalLibraries: 0,
      apiResources: {
        uniqueCount: 0,
        fullCrudCount: 0,
        readOnlyCount: 0,
        createOnlyCount: 0,
        updateOnlyCount: 0,
        deleteOnlyCount: 0,
        partialCount: 0,
        resourceMap: {}  // Internal map (removed from final output)
      }
    },
    specifications: {
      files: 0,
      languageBreakdown: {}
    },
    externalLibraries: new Set()
  };

  // Analyze each file
  for (const filePath of files) {
    try {
      const fileResults = await analyzeFile(filePath, repoPath);
      
      if (fileResults.isSpecification) {
        // Aggregate specification metrics
        results.specifications.files++;
      } else {
        // Aggregate code metrics
        results.code.classes += fileResults.classes;
        results.code.externalLibrariesAccessed += fileResults.imports;
        results.code.publicMethods += fileResults.publicMethods;
        results.code.totalFunctions += fileResults.functionsCount;
        results.code.files++;
        
        // Aggregate API resources
        if (fileResults.apiResources && fileResults.apiResources.length > 0) {
          fileResults.apiResources.forEach(resource => {
            const name = resource.name;
            if (!results.code.apiResources.resourceMap[name]) {
              results.code.apiResources.resourceMap[name] = {
                create: false,
                read: false,
                update: false,
                delete: false
              };
            }
            // Merge CRUD capabilities (if any file supports it, the resource supports it)
            if (resource.crud.create) results.code.apiResources.resourceMap[name].create = true;
            if (resource.crud.read) results.code.apiResources.resourceMap[name].read = true;
            if (resource.crud.update) results.code.apiResources.resourceMap[name].update = true;
            if (resource.crud.delete) results.code.apiResources.resourceMap[name].delete = true;
          });
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
        results.specifications.languageBreakdown[language] = (results.specifications.languageBreakdown[language] || 0) + 1;
      } else {
        results.code.languageBreakdown[language] = (results.code.languageBreakdown[language] || 0) + 1;
      }
      
    } catch (error) {
      console.warn(`Warning: Could not analyze ${filePath}: ${error.message}`);
    }
  }

  // Calculate derived metrics
  results.code.uniqueExternalLibraries = results.externalLibraries.size;
  
  // Calculate API resource summary counts
  const resourceValues = Object.values(results.code.apiResources.resourceMap);
  results.code.apiResources.uniqueCount = resourceValues.length;

  resourceValues.forEach(resource => {
    const isFullCrud = resource.create && resource.read && resource.update && resource.delete;
    const isReadOnly = resource.read && !resource.create && !resource.update && !resource.delete;
    const isCreateOnly = resource.create && !resource.read && !resource.update && !resource.delete;
    const isUpdateOnly = resource.update && !resource.create && !resource.read && !resource.delete;
    const isDeleteOnly = resource.delete && !resource.create && !resource.read && !resource.update;

    if (isFullCrud) {
      results.code.apiResources.fullCrudCount++;
    } else if (isReadOnly) {
      results.code.apiResources.readOnlyCount++;
    } else {
      results.code.apiResources.partialCount++;
    }

    if (isCreateOnly) results.code.apiResources.createOnlyCount++;
    if (isUpdateOnly) results.code.apiResources.updateOnlyCount++;
    if (isDeleteOnly) results.code.apiResources.deleteOnlyCount++;
  });

  // Remove resource names from final output
  delete results.code.apiResources.resourceMap;

  // Return clean structure with nested code/specifications
  // Remove top-level duplication to avoid confusion
  const flatResults = {
    version: results.version,
    code: results.code,
    specifications: results.specifications
  };

  // Clean up Sets for JSON serialization
  delete results.externalLibraries;

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
