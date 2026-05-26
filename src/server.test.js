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

test("supports the main user flow and admin summary", async () => {
  const { server, baseUrl } = await listen();
  try {
    const health = await request(baseUrl, "/healthz");
    assert.equal(health.response.status, 200);
    assert.equal(health.data.ok, true);

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
    const cookie = registered.response.headers
      .get("set-cookie")
      .split(",")
      .map((item) => item.trim().split(";")[0])
      .find((item) => item.startsWith("wuhao_zhiyuan_session="));

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
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
