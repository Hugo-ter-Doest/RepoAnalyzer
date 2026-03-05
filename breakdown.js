const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { analyzeFile } = require('./lib/file-analyzer');

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

async function getBreakdown(repoPath) {
  const languageStats = {};
  
  // Initialize language stats
  for (const [lang, exts] of Object.entries(CODE_EXTENSIONS)) {
    languageStats[lang] = {
      files: 0,
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0
    };
  }

  try {
    const absoluteRepoPathOrig = path.resolve(repoPath);
    const absoluteRepoPath = absoluteRepoPathOrig.replace(/\\/g, '/');
    const pattern = absoluteRepoPath + '/**/*.*';
    const files = await glob(pattern, {
      ignore: IGNORE_DIRS.map(dir => `${absoluteRepoPath}/**/${dir}/**`),
      absolute: true
    });

    for (const file of files) {
      const ext = path.extname(file);

      let language = null;
      for (const [lang, exts] of Object.entries(CODE_EXTENSIONS)) {
        if (exts.includes(ext)) {
          language = lang;
          break;
        }
      }

      if (language) {
        try {
          const results = analyzeFile(file, absoluteRepoPathOrig);
          languageStats[language].files++;
          languageStats[language].totalLines += results.linesOfCode;
          languageStats[language].codeLines += results.codeLines;
          languageStats[language].commentLines += results.commentLines;
          languageStats[language].blankLines += results.blankLines;
        } catch (err) {
          // Skip files that can't be analyzed
        }
      }
    }

    // Print results
    console.log(`\n📊 Code Breakdown for: ${absoluteRepoPathOrig}\n`);
    
    let totalCode = 0;
    let totalFiles = 0;
    
    const sorted = Object.entries(languageStats)
      .filter(([_, stats]) => stats.files > 0)
      .sort((a, b) => b[1].codeLines - a[1].codeLines);

    console.log('Language          Files    Code Lines   Comments  Blank   Total');
    console.log('─────────────────────────────────────────────────────────────');
    
    for (const [lang, stats] of sorted) {
      if (stats.files > 0) {
        console.log(
          `${lang.padEnd(16)} ${stats.files.toString().padStart(5)} ${stats.codeLines.toString().padStart(11)} ${stats.commentLines.toString().padStart(10)} ${stats.blankLines.toString().padStart(7)} ${stats.totalLines.toString().padStart(7)}`
        );
        totalCode += stats.codeLines;
        totalFiles += stats.files;
      }
    }
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`${'TOTAL'.padEnd(16)} ${totalFiles.toString().padStart(5)} ${totalCode.toString().padStart(11)}`);
    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

const repoPath = process.argv[2] || '../objects-api';
getBreakdown(repoPath);
