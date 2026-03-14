#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { analyzeRepository } = require('../lib/analyzer');

const DEBUG = true // process.env.DEBUG === 'true' || process.argv.includes('--debug');

/**
 * Hybrid batch analysis using both Lizard and RepoAnalyzer
 * Lizard: Complexity (CCN), NLOC, file count
 * RepoAnalyzer: Classes, dependencies, APIs, language breakdown
 */

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];

      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toOptionalNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_RATING_CONFIG = {
  highComplexityThreshold: 15,
  longFunctionNlocThreshold: 1000,
  starRules: [
    { stars: 5, maxAverageCCN: 2.0, maxHighComplexityRate: 1, label: 'Excellent' },
    { stars: 4, maxAverageCCN: 3.5, maxHighComplexityRate: 3, label: 'Good' },
    { stars: 3, maxAverageCCN: 5.5, maxHighComplexityRate: 7, label: 'Fair' },
    { stars: 2, maxAverageCCN: 8.0, maxHighComplexityRate: 12, label: 'Risky' },
    { stars: 1, maxAverageCCN: null, maxHighComplexityRate: null, label: 'Critical' }
  ],
  guardrails: {
    subtractOneStarAtMaxCCN: 50,
    capAtStarsWhenMaxCCNAtLeast: {
      maxCCN: 100,
      maxStars: 3
    }
  }
};

function normalizeStarRules(starRules) {
  if (!Array.isArray(starRules) || starRules.length === 0) {
    return DEFAULT_RATING_CONFIG.starRules;
  }

  const normalizedRules = starRules
    .map(rule => ({
      stars: Number.parseInt(rule.stars, 10),
      maxAverageCCN: toOptionalNumber(rule.maxAverageCCN),
      maxHighComplexityRate: toOptionalNumber(rule.maxHighComplexityRate),
      label: typeof rule.label === 'string' && rule.label.trim()
        ? rule.label.trim()
        : `Tier ${rule.stars}`
    }))
    .filter(rule => Number.isInteger(rule.stars) && rule.stars >= 1 && rule.stars <= 5)
    .sort((left, right) => right.stars - left.stars);

  if (normalizedRules.length === 0) {
    return DEFAULT_RATING_CONFIG.starRules;
  }

  const hasFallback = normalizedRules.some(
    rule => rule.stars === 1 && rule.maxAverageCCN === null && rule.maxHighComplexityRate === null
  );

  if (!hasFallback) {
    normalizedRules.push({
      stars: 1,
      maxAverageCCN: null,
      maxHighComplexityRate: null,
      label: 'Critical'
    });
  }

  DEBUG && console.log('Normalized star rules:', normalizedRules);
  return normalizedRules;
}

function loadRatingConfig(configPath) {
  let rawConfig = {};
  let source = 'defaults';

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      rawConfig = JSON.parse(content);
      source = configPath;
    } catch (error) {
      console.warn(`⚠️  Failed to parse rating config at ${configPath}. Using defaults. (${error.message})`);
    }
  }

  const guardrails = rawConfig.guardrails || {};
  const capRule = guardrails.capAtStarsWhenMaxCCNAtLeast || {};

  return {
    config: {
      highComplexityThreshold: toNumber(rawConfig.highComplexityThreshold, DEFAULT_RATING_CONFIG.highComplexityThreshold),
      longFunctionNlocThreshold: toNumber(rawConfig.longFunctionNlocThreshold, DEFAULT_RATING_CONFIG.longFunctionNlocThreshold),
      starRules: normalizeStarRules(rawConfig.starRules),
      guardrails: {
        subtractOneStarAtMaxCCN: toOptionalNumber(guardrails.subtractOneStarAtMaxCCN)
          ?? DEFAULT_RATING_CONFIG.guardrails.subtractOneStarAtMaxCCN,
        capAtStarsWhenMaxCCNAtLeast: {
          maxCCN: toOptionalNumber(capRule.maxCCN)
            ?? DEFAULT_RATING_CONFIG.guardrails.capAtStarsWhenMaxCCNAtLeast.maxCCN,
          maxStars: Number.parseInt(capRule.maxStars, 10) || DEFAULT_RATING_CONFIG.guardrails.capAtStarsWhenMaxCCNAtLeast.maxStars
        }
      }
    },
    source
  };
}

function formatStars(starCount) {
  return '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
}

function getRuleLabel(starRules, stars) {
  const exactMatch = starRules.find(rule => rule.stars === stars);
  return exactMatch ? exactMatch.label : 'Unknown';
}

function calculateFiveStarRating(averageCCN, highComplexityRate, maxCCN, ratingConfig) {
  const matchingRule = ratingConfig.starRules.find(rule => {
    const avgCcnMatch = rule.maxAverageCCN === null || averageCCN <= rule.maxAverageCCN;
    const highComplexityMatch = rule.maxHighComplexityRate === null || highComplexityRate <= rule.maxHighComplexityRate;
    return avgCcnMatch && highComplexityMatch;
  }) || ratingConfig.starRules[ratingConfig.starRules.length - 1];

  let stars = matchingRule ? matchingRule.stars : 1;

  if (ratingConfig.guardrails.subtractOneStarAtMaxCCN !== null
    && maxCCN >= ratingConfig.guardrails.subtractOneStarAtMaxCCN) {
    stars = Math.max(1, stars - 1);
  }

  const capRule = ratingConfig.guardrails.capAtStarsWhenMaxCCNAtLeast;
  if (capRule
    && capRule.maxCCN !== null
    && Number.isInteger(capRule.maxStars)
    && maxCCN >= capRule.maxCCN) {
    stars = Math.min(stars, capRule.maxStars);
  }

  return {
    stars,
    starsText: formatStars(stars),
    label: getRuleLabel(ratingConfig.starRules, stars)
  };
}

function parseLizardCSV(csvPath, ratingConfig) {
  if (!fs.existsSync(csvPath)) {
    return null;
  }

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;

  const files = new Set();
  let totalFunctions = 0;
  let totalNLOC = 0;
  let totalCCN = 0;
  let maxCCN = 0;
  let highComplexityCount = 0;
  let longFunctionCount = 0;

  for (const line of lines) {
    const parts = parseCsvLine(line);
    if (parts.length < 11) continue;

    const nloc = toInt(parts[0]);
    const ccn = toInt(parts[1]);
    const filePath = (parts[6] || '').trim();

    if (filePath) {
      files.add(filePath);
    }

    totalFunctions++;

    totalNLOC += nloc;
    totalCCN += ccn;
    if (ccn > maxCCN) {
      maxCCN = ccn;
    }
    if (ccn > ratingConfig.highComplexityThreshold) {
      highComplexityCount++;
    }
    if (nloc > ratingConfig.longFunctionNlocThreshold) {
      longFunctionCount++;
    }
  }

  return {
    totalFunctions,
    totalFiles: files.size,
    totalCCN,
    totalNLOC,
    averageNLOC: totalFunctions > 0 ? Number((totalNLOC / totalFunctions).toFixed(2)) : 0,
    averageCCN: totalFunctions > 0 ? Number((totalCCN / totalFunctions).toFixed(2)) : 0,
    maxCCN,
    highComplexityCount,
    highComplexityRate: totalFunctions > 0 ? Number(((highComplexityCount / totalFunctions) * 100).toFixed(2)) : 0,
    longFunctionCount
  };
}

async function runLizardAnalysis(repoPath, ratingConfig) {
  try {
    const csvPath = path.join(process.cwd(), `lizard-${Date.now()}.csv`);
    console.log(`  🔄 Running Lizard on ${repoPath}...`);
    
    execSync(`python -m lizard "${repoPath}" --csv > "${csvPath}" 2>&1`, {
      stdio: 'pipe',
      shell: true
    });
    
    const result = parseLizardCSV(csvPath, ratingConfig);
    
    // Clean up temp file
    if (fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
    
    return result;
  } catch (error) {
    console.warn(`  ⚠️  Lizard analysis failed: ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node batch-hybrid-analyze.js <repos.json> [output.json] [rating-config.json]');
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
  const outputFile = args[1] || 'hybrid-analysis-results.json';
  const ratingConfigFile = args[2] || path.join(__dirname, 'lizard-rating-config.json');
  const ratingConfigPath = path.isAbsolute(ratingConfigFile) ? ratingConfigFile : path.resolve(process.cwd(), ratingConfigFile);
  const { config: ratingConfig, source: ratingConfigSource } = loadRatingConfig(ratingConfigPath);

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

  console.log('\n' + '='.repeat(70));
  console.log('🔍 HYBRID BATCH ANALYSIS (Lizard + RepoAnalyzer)');
  console.log('='.repeat(70));
  console.log(`⚙️  Rating config: ${ratingConfigSource}`);

  const results = {
    timestamp: new Date().toISOString(),
    totalRepositories: inputData.repositories.length,
    repositories: [],
    summary: {
      totalNLOC: 0,
      totalClasses: 0,
      totalExternalLibraries: 0,
      totalAPIs: 0,
      totalFunctions: 0,
      totalHighComplexityFunctions: 0,
      highComplexityRate: 0,
      maxCCN: 0,
      averageComplexity: 0,
      complexityRating: '',
      complexityRatingLabel: '',
      complexityStars: 0,
      complexitySource: `Lizard CCN + %CCN>${ratingConfig.highComplexityThreshold}`,
      highComplexityThreshold: ratingConfig.highComplexityThreshold,
      longFunctionNlocThreshold: ratingConfig.longFunctionNlocThreshold
    },
    ratingConfig: {
      source: ratingConfigSource,
      highComplexityThreshold: ratingConfig.highComplexityThreshold,
      longFunctionNlocThreshold: ratingConfig.longFunctionNlocThreshold,
      starRules: ratingConfig.starRules,
      guardrails: ratingConfig.guardrails
    }
  };

  for (const repo of inputData.repositories) {
    console.log(`\n📦 Analyzing: ${repo.name || repo.path}`);
    
    try {
      // Run analyses in parallel
      const [repoAnalysis, lizardAnalysis] = await Promise.all([
        analyzeRepository(repo.path),
        runLizardAnalysis(repo.path, ratingConfig)
      ]);

      const repoResult = {
        name: repo.name || path.basename(repo.path),
        path: repo.path,
        timestamp: new Date().toISOString(),
        lineCountSource: 'lizard_nloc',
        
        // RepoAnalyzer metrics
        repositoryAnalysis: {
          codeFiles: repoAnalysis.code.files,
          specificationFiles: repoAnalysis.specifications.files,
          totalFiles: repoAnalysis.code.files + repoAnalysis.specifications.files,
          fileCount: repoAnalysis.code.files,
          classes: repoAnalysis.code.classes,
          publicMethods: repoAnalysis.code.publicMethods,
          totalFunctions: repoAnalysis.code.totalFunctions,
          externalLibraries: repoAnalysis.code.uniqueExternalLibraries,
          totalImports: repoAnalysis.code.externalLibrariesAccessed,
          apiResources: repoAnalysis.code.apiResources.uniqueCount || 0
        },

        // Lizard metrics
        lizardAnalysis: lizardAnalysis || {
          error: 'Failed to run Lizard analysis'
        }
      };

      if (lizardAnalysis) {
        const lizardRating = calculateFiveStarRating(
          lizardAnalysis.averageCCN,
          lizardAnalysis.highComplexityRate,
          lizardAnalysis.maxCCN,
          ratingConfig
        );

        repoResult.lizardAnalysis.rating = {
          stars: lizardRating.stars,
          starsText: lizardRating.starsText,
          label: lizardRating.label
        };
      }

      results.repositories.push(repoResult);

      // Update summary
      if (repoAnalysis.code) {
        results.summary.totalClasses += repoAnalysis.code.classes;
        results.summary.totalExternalLibraries += repoAnalysis.code.uniqueExternalLibraries;
        results.summary.totalAPIs += (repoAnalysis.code.apiResources.uniqueCount || 0);
      }

      if (lizardAnalysis) {
        results.summary.totalNLOC += lizardAnalysis.totalNLOC;
        results.summary.totalFunctions += lizardAnalysis.totalFunctions;
        results.summary.totalHighComplexityFunctions += lizardAnalysis.highComplexityCount;
        if (lizardAnalysis.maxCCN > results.summary.maxCCN) {
          results.summary.maxCCN = lizardAnalysis.maxCCN;
        }
      }

      // Display results
      if (lizardAnalysis) {
        console.log(`  ✅ Lizard (primary): ${lizardAnalysis.totalFiles} files, ${lizardAnalysis.totalNLOC.toLocaleString()} NLOC, ${lizardAnalysis.averageCCN} avg CCN`);
        console.log(`     └─ High complexity (CCN>${ratingConfig.highComplexityThreshold}): ${lizardAnalysis.highComplexityCount} functions (${lizardAnalysis.highComplexityRate}%)`);
        if (repoResult.lizardAnalysis.rating) {
          console.log(`     └─ Rating: ${repoResult.lizardAnalysis.rating.starsText} ${repoResult.lizardAnalysis.rating.label}`);
        }
      }
      console.log(`  ✅ RepoAnalyzer (supporting): ${repoAnalysis.code.files} files, ${repoAnalysis.code.classes} classes, ${repoAnalysis.code.uniqueExternalLibraries} dependencies`);

    } catch (error) {
      console.error(`  ❌ Error analyzing repository: ${error.message}`);
      results.repositories.push({
        name: repo.name || path.basename(repo.path),
        path: repo.path,
        error: error.message
      });
    }
  }

  // Calculate summary metrics
  if (results.summary.totalFunctions > 0) {
    const totalCCN = results.repositories.reduce((sum, repo) => {
      if (repo.lizardAnalysis && !repo.lizardAnalysis.error) {
        return sum + repo.lizardAnalysis.totalCCN;
      }
      return sum;
    }, 0);

    const avgComplexity = totalCCN / results.summary.totalFunctions;
    const highComplexityRate = (results.summary.totalHighComplexityFunctions / results.summary.totalFunctions) * 100;

    results.summary.averageComplexity = Number(avgComplexity.toFixed(2));
    results.summary.highComplexityRate = Number(highComplexityRate.toFixed(2));

    const summaryRating = calculateFiveStarRating(
      results.summary.averageComplexity,
      results.summary.highComplexityRate,
      results.summary.maxCCN,
      ratingConfig
    );

    results.summary.complexityStars = summaryRating.stars;
    results.summary.complexityRating = `${summaryRating.starsText} ${summaryRating.label}`;
    results.summary.complexityRatingLabel = summaryRating.label;
  }

  // Save results
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  // Display summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Analyzed ${results.repositories.length} repositories`);
  console.log(`📈 Total NLOC (Lizard): ${results.summary.totalNLOC.toLocaleString()}`);
  console.log(`📦 Total Classes: ${results.summary.totalClasses}`);
  console.log(`📚 External Libraries: ${results.summary.totalExternalLibraries}`);
  console.log(`🔌 API Resources: ${results.summary.totalAPIs}`);
  console.log(`📊 Average CCN (Lizard): ${results.summary.averageComplexity}`);
  console.log(`📊 High Complexity Rate (CCN>${ratingConfig.highComplexityThreshold}): ${results.summary.highComplexityRate}%`);
  console.log(`📊 Lizard Rating: ${results.summary.complexityRating}`);
  console.log(`\n💾 Results saved to: ${outputFile}`);
  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
