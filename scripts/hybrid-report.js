#!/usr/bin/env node

const fs = require('fs');

/**
 * Generate a detailed comparison report from hybrid analysis results
 */

function formatNumber(num) {
  return typeof num === 'number' ? num.toLocaleString() : num;
}

function generateReport(resultsFile, outputFile = null) {
  if (!fs.existsSync(resultsFile)) {
    console.error(`Error: Results file not found: ${resultsFile}`);
    process.exit(1);
  }

  let results;
  try {
    const content = fs.readFileSync(resultsFile, 'utf8');
    results = JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing results: ${error.message}`);
    process.exit(1);
  }

  const highComplexityThreshold =
    results?.summary?.highComplexityThreshold
    ?? results?.ratingConfig?.highComplexityThreshold
    ?? 15;

  // Build report
  let report = '';
  report += '# HYBRID CODE ANALYSIS REPORT\n\n';
  report += `**Generated:** ${new Date(results.timestamp).toLocaleString()}\n\n`;

  // Summary Section
  report += '## Executive Summary\n\n';
  report += '| Metric | Value |\n';
  report += '|--------|-------|\n';
  report += `| Total Repositories | ${results.totalRepositories} |\n`;
  report += `| Total NLOC (Lizard) | ${formatNumber(results.summary.totalNLOC || 0)} |\n`;
  report += `| Total Classes | ${formatNumber(results.summary.totalClasses)} |\n`;
  report += `| External Libraries | ${formatNumber(results.summary.totalExternalLibraries)} |\n`;
  report += `| API Resources | ${formatNumber(results.summary.totalAPIs)} |\n`;
  report += `| High Complexity Rate (CCN > ${highComplexityThreshold}) | ${results.summary.highComplexityRate || 0}% |\n`;
  report += `| Max CCN | ${results.summary.maxCCN || 0} |\n`;
  report += `| Average CCN (Lizard) | ${results.summary.averageComplexity} (${results.summary.complexityRating}) |\n\n`;

  // Detailed Repository Analysis
  report += '## Repository Analysis\n\n';

  for (const repo of results.repositories) {
    report += `### ${repo.name}\n\n`;

    if (repo.error) {
      report += `❌ **Error:** ${repo.error}\n\n`;
      continue;
    }

    // RepoAnalyzer Metrics
    report += '#### Code Metrics (RepoAnalyzer)\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';

    const ra = repo.repositoryAnalysis;
    report += `| Code Files | ${formatNumber(ra.codeFiles)} |\n`;
    report += `| Specification Files | ${formatNumber(ra.specificationFiles)} |\n`;
    report += `| Total Files | ${formatNumber(ra.totalFiles)} |\n`;
    report += `| Classes | ${formatNumber(ra.classes)} |\n`;
    report += `| Public Methods | ${formatNumber(ra.publicMethods)} |\n`;
    report += `| Total Functions | ${formatNumber(ra.totalFunctions)} |\n`;
    report += `| External Libraries | ${formatNumber(ra.externalLibraries)} |\n`;
    report += `| API Resources | ${formatNumber(ra.apiResources)} |\n`;
    report += '\n';

    // Lizard Metrics
    if (repo.lizardAnalysis && !repo.lizardAnalysis.error) {
      report += '#### Primary Metrics (Lizard)\n\n';
      report += '| Metric | Value |\n';
      report += '|--------|-------|\n';

      const lz = repo.lizardAnalysis;
      report += `| Total Functions | ${formatNumber(lz.totalFunctions)} |\n`;
      report += `| Total Files | ${formatNumber(lz.totalFiles)} |\n`;
      report += `| Total NLOC | ${formatNumber(lz.totalNLOC)} |\n`;
      report += `| Average NLOC | ${lz.averageNLOC} |\n`;
      report += `| Average CCN | ${lz.averageCCN} |\n`;
      report += `| Max CCN | ${lz.maxCCN} |\n`;
      report += `| High Complexity (CCN > ${highComplexityThreshold}) | ${formatNumber(lz.highComplexityCount)} |\n`;
      report += `| High Complexity Rate (CCN > ${highComplexityThreshold}) | ${lz.highComplexityRate || 0}% |\n`;
      report += `| Long Functions (NLOC > 1000) | ${formatNumber(lz.longFunctionCount)} |\n\n`;

      if (lz.rating) {
        report += `**Lizard Rating:** ${lz.rating.starsText} ${lz.rating.label}\n\n`;
      }
    } else if (repo.lizardAnalysis && repo.lizardAnalysis.error) {
      report += `⚠️ **Lizard Analysis:** ${repo.lizardAnalysis.error}\n\n`;
    }

    report += '---\n\n';
  }

  // Recommendations
  report += '## Recommendations\n\n';

  // Find high complexity repos
  const highComplexity = results.repositories.filter(r =>
    r.lizardAnalysis && !r.lizardAnalysis.error && r.lizardAnalysis.rating && r.lizardAnalysis.rating.stars <= 2
  );

  if (highComplexity.length > 0) {
    report += '### High Complexity Repositories\n\n';
    report += 'The following repositories have higher than recommended complexity:\n\n';
    for (const repo of highComplexity) {
      report += `- **${repo.name}:** ${repo.lizardAnalysis.rating.starsText} ${repo.lizardAnalysis.rating.label} (Avg CCN ${repo.lizardAnalysis.averageCCN}, >${highComplexityThreshold} rate ${repo.lizardAnalysis.highComplexityRate || 0}%)\n`;
    }
    report += '\n**Action:** Consider refactoring complex functions to reduce cyclomatic complexity.\n\n';
  }

  // Find repositories with high dependency count
  const highDeps = results.repositories.filter(r => 
    r.repositoryAnalysis && r.repositoryAnalysis.externalLibraries > 50
  );

  if (highDeps.length > 0) {
    report += '### High Dependency Repositories\n\n';
    report += 'The following repositories have many external dependencies:\n\n';
    for (const repo of highDeps) {
      report += `- **${repo.name}:** ${repo.repositoryAnalysis.externalLibraries} external libraries\n`;
    }
    report += '\n**Action:** Review and minimize external dependencies where possible.\n\n';
  }

  // Output
  if (outputFile) {
    fs.writeFileSync(outputFile, report);
    console.log(`✅ Report saved to: ${outputFile}`);
  } else {
    console.log(report);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node hybrid-report.js <results.json> [output.md]');
  console.error('\nExamples:');
  console.error('  node hybrid-report.js hybrid-analysis-results.json');
  console.error('  node hybrid-report.js hybrid-analysis-results.json report.md');
  process.exit(1);
}

const resultsFile = args[0];
const outputFile = args[1] || null;

generateReport(resultsFile, outputFile);
