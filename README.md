# Repository Analyzer

A comprehensive Node.js tool that analyzes code repositories and provides detailed metrics including lines of code, classes/modules, API usage, and complexity ratings.

## Features

✅ **Lines of Code Analysis**
- Total lines, code lines, comment lines, and blank lines
- Supports multiple programming languages

✅ **Classes & Modules Detection**
- Counts classes in OOP languages (JavaScript, TypeScript, Java, C#, etc.)
- Counts modules/structs in non-OOP languages (Go, Rust, etc.)

✅ **External Library Tracking**
- Detects all external dependencies imported/required in code
- Counts unique external libraries used
- Identifies all external library imports

✅ **Cyclomatic Complexity Rating**
- Calculates complexity for each function/method
- Provides average and maximum complexity scores
- Overall complexity rating (Low to Very High)

## Supported Languages

- JavaScript (.js, .jsx, .mjs, .cjs)
- TypeScript (.ts, .tsx)
- Python (.py)
- Java (.java)
- C# (.cs)
- C/C++ (.c, .cpp, .h, .hpp)
- Go (.go)
- Ruby (.rb)
- PHP (.php)
- Rust (.rs)
- HTML (.html, .htm)
- CSS (.css)
- XML (.xml)
- YAML (.yaml, .yml)
- JSON (.json)

## Installation

```bash
# Clone or navigate to the repository
cd RepoAnalyzer

# Install dependencies
npm install
```

## Usage

### Analyze Current Directory

```bash
node index.js
```

### Analyze Specific Repository

```bash
node index.js /path/to/repository
```

### Export Results to JSON

```bash
node index.js /path/to/repository --json
```

This will create a `repo-analysis.json` file in the analyzed repository.

### Batch Analysis - Multiple Repositories

Analyze multiple repositories at once and get aggregated results in JSON:

```bash
# Create a repos.json file with repository paths
node batch-analyze.js repos.json analysis-results.json
```

**Input JSON Format** (`repos.json`):
```json
{
  "repositories": [
    {
      "path": "/path/to/repo1",
      "name": "Project 1"
    },
    {
      "path": "/path/to/repo2",
      "name": "Project 2"
    },
    {
      "path": "/path/to/repo3",
      "name": "Project 3"
    }
  ]
}
```

**Output JSON Format** (`analysis-results.json`):
```json
{
  "timestamp": "2026-03-05T10:30:00.000Z",
  "totalRepositories": 3,
  "repositories": [
    {
      "name": "Project 1",
      "path": "/path/to/repo1",
      "status": "success",
      "analysis": {
        "linesOfCode": 45287,
        "codeLines": 32451,
        "commentLines": 8234,
        "blankLines": 4602,
        "classesAndModules": 267,
        "classes": 89,
        "filesAnalyzed": 245,
        "uniqueExternalLibraries": 47,
        "avgComplexity": 4.23,
        "maxComplexity": 18,
        "complexityRating": "⭐⭐ Moderate",
        "totalFunctions": 456,
        "filesAnalyzed": 245,
        "languageBreakdown": {
          "JavaScript": 120,
          "TypeScript": 85,
          "Python": 40
        }
      }
    }
  ],
  "summary": {
    "totalLinesOfCode": 135861,
    "totalClasses": 267,
    "totalFilesAnalyzed": 735,
    "totalFunctions": 1367,
    "totalDependencies": 142,
    "averageComplexity": 4.15
  }
}
```

## Output Example

```
🔍 Analyzing repository: C:\Projects\MyApp

============================================================
Found 245 code files to analyze...

📊 REPOSITORY ANALYSIS RESULTS

============================================================

📏 Lines of Code: 45,287
   - Code: 32,451
   - Comments: 8,234
   - Blank: 4,602

📦 Classes and Files: 267
   - Classes: 89
   - Files Analyzed: 245

� External Libraries Used: 47
   - Unique Dependencies: 47
   - Total Import Statements: 892


⚡ Complexity Rating: ⭐⭐ Moderate (Reasonably maintainable)
   - Average Cyclomatic Complexity: 4.23
   - Max Complexity (single function): 18
   - Functions Analyzed: 456

📁 Files Analyzed: 245
   Languages: javascript (180), typescript (45), python (12), java (8)

============================================================

✅ Analysis complete!
```

## Metrics Explained

### Lines of Code
- **Total Lines**: All lines in code files
- **Code Lines**: Lines containing actual code
- **Comment Lines**: Lines with comments or documentation
- **Blank Lines**: Empty lines

### Classes & Content Overview
- **Classes**: OOP classes (class definitions in JS, Java, C#, etc.)
- **Files Analyzed**: Total number of code files analyzed in the repository

### External Libraries Used
Counts actual external library imports and dependencies:
- **Unique Dependencies**: Number of distinct external packages/libraries your code uses
- **Total Import Statements**: Total import/require/using statements across all files

Examples detected:
- JavaScript/TypeScript: `import`, `require()`, `import()` statements
- Python: `import`, `from ... import` statements  
- Java: `import` statements
- C#: `using` statements
- Go: `import` statements
- Ruby: `require` statements
- PHP: `require`, `include` statements

### Complexity Rating

The complexity rating is based on cyclomatic complexity, which measures the number of independent paths through code. The rating considers:

- **Average Complexity**: Mean complexity across all functions
- **Max Complexity**: Highest complexity in a single function
- **Code Organization**: Lines per file ratio

**Complexity Guidelines:**
- **1-5**: Low complexity, easy to test and maintain
- **6-10**: Moderate complexity, acceptable
- **11-20**: Medium complexity, consider refactoring
- **21-50**: High complexity, should be refactored
- **51+**: Very high complexity, difficult to maintain

**Ratings:**
- ⭐ Low: Simple, easy to maintain
- ⭐⭐ Moderate: Reasonably maintainable
- ⭐⭐⭐ Medium: Getting complex
- ⭐⭐⭐⭐ High: Complex, needs refactoring
- ⭐⭐⭐⭐⭐ Very High: Very complex, difficult to maintain

## Ignored Directories

The analyzer automatically ignores common build and dependency directories:
- node_modules
- vendor
- dist, build, out
- bin, obj
- .git, .svn
- coverage
- __pycache__, .pytest_cache
- venv, env, .venv
- target
- .idea, .vscode

## API Usage

You can also use this tool programmatically:

```javascript
const { analyzeRepository } = require('./lib/analyzer');

async function analyze() {
  const results = await analyzeRepository('/path/to/repo');
  console.log(results);
}

analyze();
```

## Results Object Structure

```javascript
{
  linesOfCode: 45287,
  codeLines: 32451,
  commentLines: 8234,
  blankLines: 4602,
  classes: 89,
  filesAnalyzed: 245,
  classesAndModules: 334,
  externalLibrariesAccessed: 892,
  uniqueExternalLibraries: 47,
  publicMethods: 122,
  complexityRating: "⭐⭐ Moderate (Reasonably maintainable)",
  avgComplexity: 4.23,
  maxComplexity: 18,
  totalFunctions: 456,
  filesAnalyzed: 245,
  languageBreakdown: {
    javascript: 180,
    typescript: 45,
    python: 12,
    java: 8
  }
}
```

## License

MIT

## Contributing

Feel free to submit issues or pull requests to improve the analyzer!
