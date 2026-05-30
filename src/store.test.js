const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wuhao-store-test-"));
process.env.DATA_DIR = tempDir;

const { readStore, writeStore, backupStore, storePath } = require("./store");

test("writes store data atomically and creates restorable backups", () => {
  const store = readStore();
  store.users.push({ id: "user_test", phone: "13900001111", name: "测试", createdAt: new Date().toISOString() });
  writeStore(store);

  const saved = readStore();
  assert.equal(saved.users.length, 1);
  assert.equal(saved.users[0].id, "user_test");
  assert.equal(fs.existsSync(storePath), true);

  const backupPath = backupStore();
  assert.equal(fs.existsSync(backupPath), true);
  assert.equal(JSON.parse(fs.readFileSync(backupPath, "utf8")).users[0].id, "user_test");
});
