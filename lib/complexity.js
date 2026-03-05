const path = require('path');

/**
 * Analyzes cyclomatic complexity of code
 * Cyclomatic complexity measures the number of linearly independent paths through code
 */
function analyzeComplexity(content, fileExtension) {
  const results = {
    scores: [],
    functionsCount: 0,
    functions: [] // Track function names and complexity
  };

  // Determine which language parser to use
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(fileExtension)) {
    analyzeJavaScriptComplexity(content, results);
  } else if (fileExtension === '.py') {
    analyzePythonComplexity(content, results);
  } else if (fileExtension === '.java') {
    analyzeJavaComplexity(content, results);
  } else if (fileExtension === '.cs') {
    analyzeCSharpComplexity(content, results);
  } else if (['.cpp', '.cc', '.cxx', '.c'].includes(fileExtension)) {
    analyzeCppComplexity(content, results);
  } else if (fileExtension === '.go') {
    analyzeGoComplexity(content, results);
  } else if (fileExtension === '.rb') {
    analyzeRubyComplexity(content, results);
  } else if (fileExtension === '.php') {
    analyzePHPComplexity(content, results);
  } else if (fileExtension === '.rs') {
    analyzeRustComplexity(content, results);
  }

  return results;
}

/**
 * Calculate cyclomatic complexity for a code block
 * Counts decision points: if, else, while, for, case, catch, &&, ||, ?
 */
function calculateComplexityScore(codeBlock) {
  let complexity = 1; // Base complexity

  // Decision keywords that increase complexity
  const decisionPatterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bforeach\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b\?\s*[^:]+:/g, // Ternary operator
    /&&/g,
    /\|\|/g,
    /\bswitch\b/g
  ];

  for (const pattern of decisionPatterns) {
    const matches = codeBlock.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Generic helper to track the maximum complexity function
 * Eliminates code duplication across language analyzers
 */
function trackMaxComplexityFunction(results, functionName, complexity, content, matchIndex) {
  if (!results.maxComplexityFunction || complexity > results.maxComplexityFunction.complexity) {
    results.maxComplexityFunction = {
      name: functionName,
      complexity: complexity,
      lineNumber: content.substring(0, matchIndex).split('\n').length
    };
  }
}

function analyzeJavaScriptComplexity(content, results) {
  // Match function declarations and expressions with names
  const patterns = [
    { regex: /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/g, type: 'declaration' },
    { regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*{/g, type: 'arrow' },
    { regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*{/g, type: 'expression' }
  ];

  let match;
  for (const patternObj of patterns) {
    while ((match = patternObj.regex.exec(content)) !== null) {
      results.functionsCount++;  // Count all function definitions
      const functionName = match[1] || 'anonymous';
      const startPos = match.index;
      const functionBody = extractFunctionBody(content, startPos);
      
      if (functionBody) {
        const complexity = calculateComplexityScore(functionBody);
        results.scores.push(complexity);
        trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
      }
    }
  }
}

function analyzePythonComplexity(content, results) {
  // Match Python function definitions (including indented class methods)
  const functionRegex = /^\s*def\s+(\w+)\s*\([^)]*\):/gm;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const functionName = match[1];
    const startPos = match.index;
    const functionBody = extractPythonFunctionBody(content, startPos);
    
    if (functionBody) {
      const complexity = calculateComplexityScore(functionBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
    }
  }
}

function analyzeJavaComplexity(content, results) {
  // Match Java method declarations
  const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const methodName = match[1];
    const startPos = match.index;
    const methodBody = extractFunctionBody(content, startPos);
    
    if (methodBody) {
      const complexity = calculateComplexityScore(methodBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, methodName, complexity, content, startPos);
    }
  }
}

function analyzeCSharpComplexity(content, results) {
  // Match C# method declarations
  const methodRegex = /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const methodName = match[1];
    const startPos = match.index;
    const methodBody = extractFunctionBody(content, startPos);
    
    if (methodBody) {
      const complexity = calculateComplexityScore(methodBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, methodName, complexity, content, startPos);
    }
  }
}

function analyzeCppComplexity(content, results) {
  // Match C/C++ function definitions
  const functionRegex = /(?:\w+(?:\s*\*)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const functionName = match[1];
    const startPos = match.index;
    const functionBody = extractFunctionBody(content, startPos);
    
    if (functionBody) {
      const complexity = calculateComplexityScore(functionBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
    }
  }
}

function analyzeGoComplexity(content, results) {
  // Match Go function declarations
  const functionRegex = /func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)(?:\s*\([^)]*\))?\s*{/g;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const functionName = match[1];
    const startPos = match.index;
    const functionBody = extractFunctionBody(content, startPos);
    
    if (functionBody) {
      const complexity = calculateComplexityScore(functionBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
    }
  }
}

function analyzeRubyComplexity(content, results) {
  // Match Ruby method definitions
  const methodRegex = /^\s*def\s+(\w+)/gm;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const methodName = match[1];
    const startPos = match.index;
    const methodBody = extractRubyMethodBody(content, startPos);
    
    if (methodBody) {
      const complexity = calculateComplexityScore(methodBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, methodName, complexity, content, startPos);
    }
  }
}

function analyzePHPComplexity(content, results) {
  // Match PHP function and method declarations
  const functionRegex = /(?:public|private|protected)?\s*function\s+(\w+)\s*\([^)]*\)\s*{/g;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const functionName = match[1];
    const startPos = match.index;
    const functionBody = extractFunctionBody(content, startPos);
    
    if (functionBody) {
      const complexity = calculateComplexityScore(functionBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
    }
  }
}

function analyzeRustComplexity(content, results) {
  // Match Rust function declarations
  const functionRegex = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]+>)?\s*\([^)]*\)(?:\s*->\s*[^{]+)?\s*{/g;
  let match;

  while ((match = functionRegex.exec(content)) !== null) {
    results.functionsCount++;  // Count all function definitions
    const functionName = match[1];
    const startPos = match.index;
    const functionBody = extractFunctionBody(content, startPos);
    
    if (functionBody) {
      const complexity = calculateComplexityScore(functionBody);
      results.scores.push(complexity);
      trackMaxComplexityFunction(results, functionName, complexity, content, startPos);
    }
  }
}

/**
 * Extract function body by counting braces
 */
function extractFunctionBody(content, startPos) {
  const openBraceIndex = content.indexOf('{', startPos);
  if (openBraceIndex === -1) return null;

  let braceCount = 0;
  let endIndex = openBraceIndex;

  for (let i = openBraceIndex; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    
    if (braceCount === 0) {
      endIndex = i;
      break;
    }
  }

  return content.substring(openBraceIndex, endIndex + 1);
}

/**
 * Extract Python function body by indentation
 */
function extractPythonFunctionBody(content, startPos) {
  const lines = content.substring(startPos).split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const baseIndent = firstLine.match(/^\s*/)[0].length;
  
  let body = firstLine + '\n';
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const currentIndent = line.match(/^\s*/)[0].length;
    
    // If line is not empty and indent is same or less than base, function ended
    if (line.trim() !== '' && currentIndent <= baseIndent) {
      break;
    }
    
    body += line + '\n';
  }

  return body;
}

/**
 * Extract Ruby method body (ends with 'end')
 */
function extractRubyMethodBody(content, startPos) {
  const lines = content.substring(startPos).split('\n');
  if (lines.length === 0) return null;

  let body = '';
  let endCount = 1; // Need to find matching 'end'

  for (const line of lines) {
    body += line + '\n';
    
    // Count block-starting keywords
    if (/\b(def|class|module|if|unless|while|until|for|begin|case)\b/.test(line)) {
      endCount++;
    }
    
    // Count 'end' keywords
    if (/\bend\b/.test(line)) {
      endCount--;
      if (endCount === 0) break;
    }
  }

  return body;
}

/**
 * Calculate overall complexity rating based on metrics
 */
function calculateComplexityRating(avgComplexity, maxComplexity, linesOfCode, filesCount) {
  let score = 0;

  // Average complexity scoring
  if (avgComplexity <= 5) score += 0;
  else if (avgComplexity <= 10) score += 1;
  else if (avgComplexity <= 20) score += 2;
  else score += 3;

  // Max complexity scoring
  if (maxComplexity <= 10) score += 0;
  else if (maxComplexity <= 20) score += 1;
  else if (maxComplexity <= 50) score += 2;
  else score += 3;

  // Lines per file scoring
  const avgLinesPerFile = filesCount > 0 ? linesOfCode / filesCount : 0;
  if (avgLinesPerFile <= 200) score += 0;
  else if (avgLinesPerFile <= 500) score += 1;
  else if (avgLinesPerFile <= 1000) score += 2;
  else score += 3;

  // Determine rating
  if (score <= 1) return '⭐ Low (Simple, easy to maintain)';
  if (score <= 3) return '⭐⭐ Moderate (Reasonably maintainable)';
  if (score <= 5) return '⭐⭐⭐ Medium (Getting complex)';
  if (score <= 7) return '⭐⭐⭐⭐ High (Complex, needs refactoring)';
  return '⭐⭐⭐⭐⭐ Very High (Very complex, difficult to maintain)';
}

module.exports = {
  analyzeComplexity,
  calculateComplexityRating
};
