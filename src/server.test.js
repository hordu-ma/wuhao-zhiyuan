const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wuhao-zhiyuan-test-"));
process.env.DATA_DIR = tempDir;
process.env.ADMIN_TOKEN = "test-admin-token";
delete process.env.DASHSCOPE_API_KEY;
delete process.env.ALIYUN_API_KEY;

const { app } = require("./server");
const { questions } = require("./mbti");

function listen() {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function request(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function getSessionCookie(response) {
  return response.headers
    .get("set-cookie")
    .split(",")
    .map((item) => item.trim().split(";")[0])
    .find((item) => item.startsWith("wuhao_zhiyuan_session="));
}

test("supports the main user flow and admin summary", async () => {
  const { server, baseUrl } = await listen();
  try {
    const health = await request(baseUrl, "/healthz");
    assert.equal(health.response.status, 200);
    assert.equal(health.data.ok, true);

    const campuses = await request(baseUrl, "/api/campuses");
    assert.deepEqual(
      campuses.data.campuses.map((campus) => ({
        name: campus.name,
        phone: campus.phone,
        wechat: campus.wechat,
        address: campus.address,
      })),
      [
        {
          name: "五好生涯青州咨询中心",
          phone: "15689896888",
          wechat: "lixuwei-",
          address: "潍坊青州市海岱中路2426号",
        },
        {
          name: "五好生涯济南咨询中心",
          phone: "18765880081",
          wechat: "malphaxe7",
          address: "济南市市中区二环东路12550号",
        },
      ]
    );

    const registered = await request(baseUrl, "/api/auth/register?source=test-qr", {
      method: "POST",
      body: JSON.stringify({
        name: "测试学生",
        gender: "男",
        phone: "13900000001",
        password: "secret123",
        privacyConsent: true,
      }),
    });
    assert.equal(registered.response.status, 200);
    const cookie = getSessionCookie(registered.response);

    const profile = await request(baseUrl, "/api/profile/student", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify({
        province: "山东",
        subjects: "物化生",
        score: "612",
        rank: "28000",
        targetCities: "济南、青岛",
        majorInterests: "计算机、自动化",
      }),
    });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.data.user.studentProfile.province, "山东");

    const mbti = await request(baseUrl, "/api/mbti/submit", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify({ answers: questions.map(() => 4) }),
    });
    assert.equal(mbti.response.status, 200);
    assert.match(mbti.data.mbti.type, /^[EISNTFJP]{4}$/);

    const chat = await request(baseUrl, "/api/chat/message", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify({ message: "山东，物化生，总分612，位次28000，想去济南或青岛。" }),
    });
    assert.equal(chat.response.status, 200);
    assert.equal(chat.data.source, "mock-ai");

    const report = await request(baseUrl, "/api/report/generate", {
      method: "POST",
      headers: { Cookie: cookie },
      body: "{}",
    });
    assert.equal(report.response.status, 200);
    assert.match(report.data.downloadUrl, /^\/reports\/report_/);

    const admin = await request(baseUrl, "/api/admin/summary", {
      headers: { "x-admin-token": "test-admin-token" },
    });
    assert.equal(admin.response.status, 200);
    assert.equal(admin.data.stats.users, 1);
    assert.equal(admin.data.stats.reports, 1);

    const mbtiCsvResponse = await fetch(`${baseUrl}/api/admin/mbti.csv`, {
      headers: { "x-admin-token": "test-admin-token" },
    });
    const mbtiCsv = await mbtiCsvResponse.text();
    assert.equal(mbtiCsvResponse.status, 200);
    assert.match(mbtiCsv, /^mbtiId,userId,name,gender,phone,source,province,subjects,score,rank,type,/);
    assert.match(mbtiCsv, /"测试学生","男","13900000001"/);

    const chatsCsvResponse = await fetch(`${baseUrl}/api/admin/chats.csv`, {
      headers: { "x-admin-token": "test-admin-token" },
    });
    const chatsCsv = await chatsCsvResponse.text();
    assert.equal(chatsCsvResponse.status, 200);
    assert.match(chatsCsv, /^sessionId,userId,name,phone,source,sessionCreatedAt,messageCreatedAt,role,messageSource,content/);
    assert.match(chatsCsv, /"测试学生","13900000001"/);
    assert.match(chatsCsv, /"mock-ai"/);

    const reportsCsvResponse = await fetch(`${baseUrl}/api/admin/reports.csv`, {
      headers: { "x-admin-token": "test-admin-token" },
    });
    const reportsCsv = await reportsCsvResponse.text();
    assert.equal(reportsCsvResponse.status, 200);
    assert.match(reportsCsv, /^reportId,userId,name,phone,source,chatSessionId,mbtiId,downloadUrl,createdAt/);
    assert.match(reportsCsv, /"\/reports\/report_/);

    const fullExport = await request(baseUrl, "/api/admin/export.json", {
      headers: { "x-admin-token": "test-admin-token" },
    });
    assert.equal(fullExport.response.status, 200);
    assert.equal(fullExport.data.stats.reports, 1);
    assert.equal(fullExport.data.users[0].passwordHash, undefined);
    assert.equal(fullExport.data.sessions, undefined);
    assert.equal(fullExport.data.chatSessions[0].messages.some((message) => message.source === "mock-ai"), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rejects invalid auth and protects user routes", async () => {
  const { server, baseUrl } = await listen();
  try {
    const invalidRegister = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "测试学生",
        gender: "女",
        phone: "123",
        password: "secret123",
        privacyConsent: true,
      }),
    });
    assert.equal(invalidRegister.response.status, 400);
    assert.equal(invalidRegister.data.error, "请输入 11 位手机号");

    const noConsent = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "测试学生",
        gender: "女",
        phone: "13900000002",
        password: "secret123",
      }),
    });
    assert.equal(noConsent.response.status, 400);
    assert.equal(noConsent.data.error, "请先确认隐私与服务提示");

    const protectedRoute = await request(baseUrl, "/api/profile/student", {
      method: "POST",
      body: JSON.stringify({ province: "山东" }),
    });
    assert.equal(protectedRoute.response.status, 401);
    assert.equal(protectedRoute.data.error, "请先注册或登录");

    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: "13900000002", password: "wrong-password" }),
    });
    assert.equal(login.response.status, 401);
    assert.equal(login.data.error, "手机号或密码错误");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("exports leads and creates admin backups", async () => {
  const { server, baseUrl } = await listen();
  try {
    const registered = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "线索学生",
        gender: "女",
        phone: "13900000003",
        password: "secret123",
        privacyConsent: true,
        province: "山东",
        subjects: "史地政",
      }),
    });
    assert.equal(registered.response.status, 200);

    const unauthorized = await request(baseUrl, "/api/admin/summary", {
      headers: { "x-admin-token": "wrong-token" },
    });
    assert.equal(unauthorized.response.status, 401);

    const csvResponse = await fetch(`${baseUrl}/api/admin/leads.csv`, {
      headers: { "x-admin-token": "test-admin-token" },
    });
    const csv = await csvResponse.text();
    assert.equal(csvResponse.status, 200);
    assert.match(csv, /^name,gender,phone,source,createdAt,mbti,reports,/);
    assert.match(csv, /"线索学生","女","13900000003"/);

    const backup = await request(baseUrl, "/api/admin/backup", {
      method: "POST",
      headers: { "x-admin-token": "test-admin-token" },
      body: "{}",
    });
    assert.equal(backup.response.status, 200);
    assert.equal(backup.data.ok, true);
    assert.equal(fs.existsSync(backup.data.backupPath), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rate limits repeated login failures", async () => {
  const { server, baseUrl } = await listen();
  try {
    const headers = { "X-Forwarded-For": "203.0.113.10" };
    for (let index = 0; index < 40; index += 1) {
      const login = await request(baseUrl, "/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: "13900009999", password: "wrong-password" }),
      });
      assert.equal(login.response.status, 401);
    }

    const limited = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: "13900009999", password: "wrong-password" }),
    });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.data.error, "请求过于频繁，请稍后再试");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
