#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { analyzeRepository } = require('./lib/analyzer');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node batch-analyze.js <input.json> [output.json]');
    console.error('\nInput JSON format:');
    console.error(JSON.stringify({
      repositories: [
        { path: '/path/to/repo1', name: 'Project 1' },
        { path: '/path/to/repo2', name: 'Project 2' }
      ]
    }, null, 2));
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || 'analysis-results.json';

  // Read input JSON
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }

  let inputData;
  try {
    const content = fs.readFileSync(inputFile, 'utf8');
    inputData = JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing input JSON: ${error.message}`);
    process.exit(1);
  }

  if (!inputData.repositories || !Array.isArray(inputData.repositories)) {
    console.error('Error: Input JSON must contain a "repositories" array');
    process.exit(1);
  }

  const results = {
    timestamp: new Date().toISOString(),
    totalRepositories: inputData.repositories.length,
    repositories: [],
    summary: {
      totalLinesOfCode: 0,
      totalClasses: 0,
      totalFilesAnalyzed: 0,
      totalFunctions: 0,
      totalDependencies: 0,
      averageComplexity: 0
    }
  };

  console.log(`\n📊 Batch Analysis Starting...`);
  console.log(`📂 Repositories to analyze: ${inputData.repositories.length}\n`);

  let completedCount = 0;
  let complexitySum = 0;

  for (const repo of inputData.repositories) {
    const repoPath = repo.path;
    const repoName = repo.name || path.basename(repoPath);
    
    try {
      console.log(`⏳ Analyzing: ${repoName}...`);
      const analyzeResults = await analyzeRepository(repoPath);
      
      results.repositories.push({
        name: repoName,
        path: repoPath,
        status: 'success',
        analysis: analyzeResults
      });

      // Accumulate summary stats (from nested code structure)
      results.summary.totalLinesOfCode += analyzeResults.code.linesOfCode;
      results.summary.totalClasses += analyzeResults.code.classes;
      results.summary.totalFilesAnalyzed += analyzeResults.code.files + analyzeResults.specifications.files;
      results.summary.totalFunctions += (analyzeResults.code.totalFunctions ?? 0);
      results.summary.totalDependencies += analyzeResults.code.uniqueExternalLibraries;
      complexitySum += analyzeResults.code.avgComplexity;

      completedCount++;
      console.log(`✅ ${repoName} - Success\n`);
    } catch (error) {
      console.error(`❌ ${repoName} - Error: ${error.message}\n`);
      results.repositories.push({
        name: repoName,
        path: repoPath,
        status: 'error',
        error: error.message
      });
    }
  }

  // Calculate average complexity
  if (completedCount > 0) {
    results.summary.averageComplexity = (complexitySum / completedCount).toFixed(2);
  }

  // Write results to output file
  try {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log('\n' + '='.repeat(60));
    console.log(`📝 Results saved to: ${outputFile}`);
    console.log('='.repeat(60));
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Successfully analyzed: ${completedCount}/${inputData.repositories.length}`);
    console.log(`   📊 Total Lines of Code: ${results.summary.totalLinesOfCode.toLocaleString()}`);
    console.log(`   📦 Total Classes: ${results.summary.totalClasses}`);
    console.log(`   🧮 Total Functions: ${results.summary.totalFunctions}`);
    console.log(`   � Total Files Analyzed: ${results.summary.totalFilesAnalyzed}`);
    console.log(`   📚 Total Dependencies: ${results.summary.totalDependencies}`);
    console.log(`   ⚡ Average Complexity: ${results.summary.averageComplexity}`);
    console.log('');
  } catch (error) {
    console.error(`Error writing results file: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
