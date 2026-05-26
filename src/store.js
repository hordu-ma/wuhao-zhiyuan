const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");
const backupDir = path.join(dataDir, "backups");

const initialStore = {
  users: [],
  sessions: [],
  mbtiResults: [],
  chatSessions: [],
  reports: [],
  events: [],
  campuses: [
    {
      id: "wuhao-career-qingzhou",
      name: "五好生涯青州咨询中心",
      phone: "18888333726",
      wechat: "lixuwei-",
      address: "潍坊青州市海岱中路2426号",
      serviceArea: "高考志愿初评、报告解读、人工复核预约",
    },
    {
      id: "wuhao-career-jinan",
      name: "五好生涯济南咨询中心",
      phone: "18765880081",
      wechat: "malphaxe7",
      address: "济南市市中区二环东路12550号",
      serviceArea: "山东考生志愿填报、专业选择、生涯规划",
    },
  ],
};

function parseCampuses() {
  if (!process.env.CAMPUS_CONFIG_JSON) return initialStore.campuses;
  try {
    const campuses = JSON.parse(process.env.CAMPUS_CONFIG_JSON);
    if (Array.isArray(campuses) && campuses.length) return campuses;
  } catch (error) {
    console.error("Invalid CAMPUS_CONFIG_JSON:", error.message);
  }
  return initialStore.campuses;
}

function normalizeStore(data) {
  const normalized = { ...initialStore, ...data };
  normalized.users = Array.isArray(normalized.users) ? normalized.users : [];
  normalized.sessions = Array.isArray(normalized.sessions) ? normalized.sessions : [];
  normalized.mbtiResults = Array.isArray(normalized.mbtiResults) ? normalized.mbtiResults : [];
  normalized.chatSessions = Array.isArray(normalized.chatSessions) ? normalized.chatSessions : [];
  normalized.reports = Array.isArray(normalized.reports) ? normalized.reports : [];
  normalized.events = Array.isArray(normalized.events) ? normalized.events : [];
  normalized.campuses = parseCampuses();
  return normalized;
}

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  return normalizeStore(JSON.parse(fs.readFileSync(storePath, "utf8")));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

function updateStore(mutator) {
  const data = readStore();
  const result = mutator(data);
  writeStore(data);
  return result;
}

function backupStore() {
  ensureStore();
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDir, `store-${stamp}.json`);
  fs.copyFileSync(storePath, backupPath);
  return backupPath;
}

module.exports = { readStore, writeStore, updateStore, backupStore, storePath, backupDir };
