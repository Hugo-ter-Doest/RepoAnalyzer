# Repository Analyzer

Repository Analyzer provides repository-wide structure and dependency metrics.

Line-count and cyclomatic complexity metrics are handled through the hybrid Lizard workflow.

## Features

✅ **Repository Structure Metrics**
- Total code files and specification/config files
- Class count
- Public method/function count
- Total function count
- Language breakdown by file count

✅ **Dependency Metrics**
- External library detection from imports/requires/usings
- Unique dependency count
- Total import/reference statement count

✅ **API Resource Detection**
- Resource + CRUD capability detection
- Summary counts for full CRUD, read-only, and partial resources

✅ **Hybrid Complexity Workflow (Lizard + RepoAnalyzer)**
- Lizard for `NLOC`, `CCN`, `max CCN`, and high-complexity rate
- Configurable 5-star rating via `scripts/lizard-rating-config.json`
- Markdown reporting via `scripts/hybrid-report.js`

## Supported Languages

- JavaScript (.js, .jsx, .mjs, .cjs)
- TypeScript (.ts, .tsx)
- Python (.py)
- Java (.java)
- Kotlin (.kt, .kts)
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
cd RepoAnalyzer
npm install
```

For hybrid complexity analysis:

```bash
python -m pip install lizard
```

## Testing

Run the Jasmine test suite:

```bash
npm test
```

## Usage

### Analyze a Single Repository

```bash
node index.js /path/to/repository
```

Export result JSON into analyzed repository:

```bash
node index.js /path/to/repository --json
```

### Batch Analysis (Hybrid)

```bash
# Uses scripts/lizard-rating-config.json by default
node scripts/batch-hybrid-analyze.js repos.json hybrid-analysis-results.json

# Or use npm script
npm run batch -- repos.json hybrid-analysis-results.json

# Optional custom rating config
node scripts/batch-hybrid-analyze.js repos.json hybrid-analysis-results.json custom-lizard-rating-config.json
```

Generate markdown report:

```bash
node scripts/hybrid-report.js hybrid-analysis-results.json hybrid-analysis-report.md

# Or use npm script
npm run report -- hybrid-analysis-results.json hybrid-analysis-report.md
```

## Batch Input Format (`repos.json`)

```json
{
  "repositories": [
    { "path": "/path/to/repo1", "name": "Project 1" },
    { "path": "/path/to/repo2", "name": "Project 2" }
  ]
}
```

## `analyzeRepository` Result Shape

```javascript
{
  version: "1.0.0",
  code: {
    classes: 89,
    files: 245,
    publicMethods: 122,
    totalFunctions: 122,
    languageBreakdown: {
      javascript: 180,
      typescript: 45,
      python: 20
    },
    externalLibrariesAccessed: 892,
    uniqueExternalLibraries: 47,
    apiResources: {
      uniqueCount: 12,
      fullCrudCount: 3,
      readOnlyCount: 5,
      createOnlyCount: 1,
      updateOnlyCount: 0,
      deleteOnlyCount: 0,
      partialCount: 4
    }
  },
  specifications: {
    files: 12,
    languageBreakdown: {
      json: 8,
      yaml: 4
    }
  }
}
```

## Hybrid Output Highlights

- RepoAnalyzer metrics: files, classes, methods/functions, dependencies, APIs
- Lizard metrics: total files, total functions, NLOC, avg/max CCN
- Quality indicators: high-complexity rate + 5-star rating

## API Usage (Programmatic)

```javascript
const { analyzeRepository } = require('./lib/analyzer');

async function run() {
  const results = await analyzeRepository('/path/to/repo');
  console.log(results);
}

run();
```

## Ignored Directories

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

## License

See [LICENSE](LICENSE).

## Contributing

Issues and pull requests are welcome.
