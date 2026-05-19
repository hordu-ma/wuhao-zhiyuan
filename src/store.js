const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");

const initialStore = {
  users: [],
  sessions: [],
  mbtiResults: [],
  chatSessions: [],
  reports: [],
  campuses: [
    {
      id: "mock-campus-jinan",
      name: "济南校区",
      phone: "0531-0000-0001",
      wechat: "wuhao-jinan",
      address: "待补充",
    },
    {
      id: "mock-campus-qingdao",
      name: "青岛校区",
      phone: "0532-0000-0002",
      wechat: "wuhao-qingdao",
      address: "待补充",
    },
    {
      id: "mock-campus-online",
      name: "线上咨询中心",
      phone: "400-000-0529",
      wechat: "wuhao-zhixue",
      address: "线上服务",
    },
  ],
};

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
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

module.exports = { readStore, writeStore, updateStore, storePath };
