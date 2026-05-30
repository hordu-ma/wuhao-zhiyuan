const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");
const backupDir = path.join(dataDir, "backups");
const sourcePath = process.argv[2];

function stamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

if (!sourcePath) {
  console.error("Usage: node scripts/restore-store.js <backup-json-path>");
  process.exit(1);
}

const resolvedSource = path.resolve(sourcePath);
if (!fs.existsSync(resolvedSource)) {
  console.error(`Backup file not found: ${resolvedSource}`);
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(resolvedSource, "utf8"));
if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users)) {
  console.error("Backup file is not a valid wuhao-zhiyuan store JSON");
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

if (fs.existsSync(storePath)) {
  const safetyBackup = path.join(backupDir, `pre-restore-${stamp()}.json`);
  fs.copyFileSync(storePath, safetyBackup);
  console.log(`Current store backed up to ${safetyBackup}`);
}

const tempPath = path.join(dataDir, `.restore-${process.pid}-${Date.now()}.tmp`);
fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2));
fs.renameSync(tempPath, storePath);
console.log(`Restored store from ${resolvedSource}`);
