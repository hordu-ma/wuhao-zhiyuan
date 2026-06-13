const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");
const backupDir = path.join(dataDir, "backups");
const lockPath = path.join(dataDir, ".store.lock");

// 本地 JSON 存储的正确性依赖一个硬前提：单进程运行，且每个 updateStore 的
// mutator 同步执行、内部不出现 await。这样事件循环会把每次读-改-写完整串行化，
// 不会丢更新。下面的 assertSyncMutator 与 acquireSingleInstanceLock 把这个隐性
// 前提显式化并强制执行；多实例或异步 mutator 都会被立即拒绝，而不是悄悄丢数据。
// 真正的水平扩展需要迁移到带事务的数据库（见 tasks.md 的 json-store 技术债）。

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
  const tempPath = path.join(dataDir, `.store-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, storePath);
}

function updateStore(mutator) {
  const data = readStore();
  const result = mutator(data);
  // 异步 mutator 会在 writeStore 之后继续改动 data，导致这部分修改无法持久化。
  // 不静默吞掉这个 bug，直接抛出，保证调用方在写入前就发现问题。
  if (result && typeof result.then === "function") {
    throw new Error("updateStore mutator 必须同步执行，不能返回 Promise（请在 await 之后再调用 updateStore）");
  }
  writeStore(data);
  return result;
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

// 在服务进程启动时获取独占锁，确保同一份 store.json 只有一个写进程。
// 返回释放函数；调用方应在收到退出信号时调用它。
function acquireSingleInstanceLock() {
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existingPid = Number(String(fs.readFileSync(lockPath, "utf8")).trim());
    if (isPidAlive(existingPid) && existingPid !== process.pid) {
      throw new Error(
        `检测到另一个实例（pid ${existingPid}）正持有 ${lockPath}；本地 JSON 存储要求单进程运行，拒绝启动以防数据竞争`
      );
    }
    fs.writeFileSync(lockPath, String(process.pid)); // 回收陈旧锁
  }
  let released = false;
  return function releaseSingleInstanceLock() {
    if (released) return;
    released = true;
    try {
      const owner = Number(String(fs.readFileSync(lockPath, "utf8")).trim());
      if (owner === process.pid) fs.unlinkSync(lockPath);
    } catch (error) {
      /* 锁文件已不存在，忽略 */
    }
  };
}

function backupStore() {
  ensureStore();
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDir, `store-${stamp}.json`);
  fs.copyFileSync(storePath, backupPath);
  return backupPath;
}

module.exports = { readStore, writeStore, updateStore, backupStore, acquireSingleInstanceLock, storePath, backupDir };
