const fs = require('fs');
const os = require('os');
const path = require('path');

function createTempDir(prefix = 'repo-analyzer-spec-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(rootDir, relativePath, content) {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

module.exports = {
  createTempDir,
  writeFile,
  removeDir
};
