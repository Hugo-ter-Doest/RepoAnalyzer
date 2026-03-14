#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { analyzeRepository } = require('./lib/analyzer');

async function main() {
  const args = process.argv.slice(2);
  const repoPath = args[0] || process.cwd();

  console.log(`\n🔍 Analyzing repository: ${repoPath}\n`);
  console.log('='.repeat(60));

  try {
    const results = await analyzeRepository(repoPath);
    
    console.log('\n📊 REPOSITORY ANALYSIS RESULTS\n');
    console.log('='.repeat(60));
    
    // Display code metrics
    console.log(`\n📝 CODE METRICS`);
    console.log(`   Version: ${results.version}`);
    console.log(`   Files: ${results.code.files}`);
    console.log(`\n   Classes: ${results.code.classes}`);
    console.log(`   Public Methods: ${results.code.publicMethods}`);
    console.log(`   Total Functions: ${results.code.totalFunctions}`);
    console.log(`\n   External Libraries: ${results.code.uniqueExternalLibraries}`);
    console.log(`   - Total Imports: ${results.code.externalLibrariesAccessed}`);
    
    // Display API resources
    if (results.code.apiResources && results.code.apiResources.uniqueCount > 0) {
      console.log(`\n   🔌 API Resources: ${results.code.apiResources.uniqueCount} unique`);

      const apiResources = results.code.apiResources;
      console.log(`      Full CRUD:  ${apiResources.fullCrudCount.toString().padStart(4)}`);
      console.log(`      Read-only:  ${apiResources.readOnlyCount.toString().padStart(4)}`);
      if (apiResources.partialCount > 0) console.log(`      Partial:    ${apiResources.partialCount.toString().padStart(4)}`);
      if (apiResources.createOnlyCount > 0) console.log(`      Create-only: ${apiResources.createOnlyCount.toString().padStart(3)}`);
      if (apiResources.updateOnlyCount > 0) console.log(`      Update-only: ${apiResources.updateOnlyCount.toString().padStart(3)}`);
      if (apiResources.deleteOnlyCount > 0) console.log(`      Delete-only: ${apiResources.deleteOnlyCount.toString().padStart(3)}`);
    }
    
    console.log(`\n   Languages (by files):`);
    Object.entries(results.code.languageBreakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([lang, files]) => {
        console.log(`      ${lang.padEnd(12)} ${files.toLocaleString().padStart(8)} files`);
      });
    
    // Display specifications metrics
    if (results.specifications.files > 0) {
      console.log(`\n📋 SPECIFICATIONS & CONFIG`);
      console.log(`   - Files: ${results.specifications.files}`);
      console.log(`\n   Types (by files):`);
      Object.entries(results.specifications.languageBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([lang, files]) => {
          console.log(`      ${lang.padEnd(12)} ${files.toLocaleString().padStart(8)} files`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Analysis complete!\n');

    // Export to JSON if requested
    if (args.includes('--json')) {
      const outputPath = path.join(repoPath, 'repo-analysis.json');
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`📄 JSON report saved to: ${outputPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ Error analyzing repository:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
