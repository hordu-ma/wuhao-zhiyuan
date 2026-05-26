const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { readStore, writeStore, updateStore, backupStore, storePath, backupDir } = require("./store");
const { questions, scoreMbti } = require("./mbti");
const { buildSystemPrompt, callDashScope, mockReply } = require("./ai");
const { generateReport, reportDir } = require("./report");
const { hashPassword, verifyPassword, id, createSession, clearSession, getCurrentUser, publicUser } = require("./auth");

const app = express();
const port = Number(process.env.PORT || 18082);
const startedAt = new Date().toISOString();
const rateBuckets = new Map();

function sanitizeText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeStudentProfile(body = {}) {
  return {
    province: sanitizeText(body.province, 20),
    subjects: sanitizeText(body.subjects, 40),
    score: sanitizeText(body.score, 20),
    rank: sanitizeText(body.rank, 30),
    targetCities: sanitizeText(body.targetCities, 80),
    majorInterests: sanitizeText(body.majorInterests, 120),
    budget: sanitizeText(body.budget, 80),
    acceptance: sanitizeText(body.acceptance, 80),
  };
}

function compactProfile(profile = {}) {
  return Object.fromEntries(Object.entries(profile).filter(([, value]) => value));
}

function getSource(req) {
  return sanitizeText(req.query.source || req.query.utm_source || req.query.campus || req.cookies?.wuhao_source, 80);
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > max) return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
    next();
  };
}

function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: "未配置 ADMIN_TOKEN，后台不可用" });
  const provided = req.get("x-admin-token") || req.query.token;
  if (provided !== token) return res.status(401).json({ error: "后台访问令牌无效" });
  next();
}

function createStats(store) {
  return {
    users: store.users.length,
    mbtiResults: store.mbtiResults.length,
    chatSessions: store.chatSessions.length,
    reports: store.reports.length,
    leads: store.users.filter((user) => user.phone).length,
    completedProfiles: store.users.filter((user) => Object.keys(compactProfile(user.studentProfile || {})).length >= 5).length,
  };
}

function toLeadRows(store) {
  return store.users.map((user) => {
    const mbti = store.mbtiResults.filter((item) => item.userId === user.id).at(-1);
    const reports = store.reports.filter((item) => item.userId === user.id);
    return {
      id: user.id,
      name: user.name,
      gender: user.gender,
      phone: user.phone,
      source: user.source || "",
      createdAt: user.createdAt,
      mbti: mbti?.type || "",
      reports: reports.length,
      profile: user.studentProfile || {},
    };
  });
}

function userById(store) {
  return new Map(store.users.map((user) => [user.id, user]));
}

function exportUser(user) {
  if (!user) return {};
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function sendCsv(res, headers, rows) {
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  res.type("text/csv").send(csv);
}

function createFullExport(store) {
  return {
    generatedAt: new Date().toISOString(),
    stats: createStats(store),
    users: store.users.map(exportUser),
    mbtiResults: store.mbtiResults,
    chatSessions: store.chatSessions,
    reports: store.reports.map((report) => ({
      ...report,
      downloadUrl: `/reports/${report.id}.pdf`,
    })),
    events: store.events,
    campuses: store.campuses,
  };
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || "dev-session-secret"));
app.set("trust proxy", 1);
app.use((req, res, next) => {
  const source = getSource(req);
  if (source) res.cookie("wuhao_source", source, { sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 30 });
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));

function requireUser(req, res, next) {
  const store = readStore();
  const user = getCurrentUser(req, store);
  if (!user) return res.status(401).json({ error: "请先注册或登录" });
  req.store = store;
  req.user = user;
  next();
}

app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "wuhao-zhiyuan", startedAt, storePath });
});

app.get("/api/me", (req, res) => {
  const store = readStore();
  const user = getCurrentUser(req, store);
  const mbti = user ? store.mbtiResults.filter((item) => item.userId === user.id).at(-1) || null : null;
  const reports = user ? store.reports.filter((item) => item.userId === user.id) : [];
  res.json({ user: publicUser(user), mbti, reports });
});

app.post("/api/auth/register", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "register" }), (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  const name = String(req.body.name || "").trim();
  const gender = String(req.body.gender || "").trim();
  const privacyConsent = req.body.privacyConsent === true || req.body.privacyConsent === "on" || req.body.privacyConsent === "true";

  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: "请输入 11 位手机号" });
  if (password.length < 6) return res.status(400).json({ error: "密码至少 6 位" });
  if (!name) return res.status(400).json({ error: "请输入姓名" });
  if (!gender) return res.status(400).json({ error: "请选择性别" });
  if (!privacyConsent) return res.status(400).json({ error: "请先确认隐私与服务提示" });

  const result = updateStore((store) => {
    if (store.users.some((item) => item.phone === phone)) {
      return { error: "该手机号已注册" };
    }
    const user = {
      id: id("user"),
      phone,
      passwordHash: hashPassword(password),
      name,
      gender,
      source: getSource(req),
      privacyConsentAt: new Date().toISOString(),
      studentProfile: compactProfile(sanitizeStudentProfile(req.body)),
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    const token = createSession(res, store, user.id);
    return { user: publicUser(user), token };
  });

  if (result.error) return res.status(409).json({ error: result.error });
  res.json(result);
});

app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyPrefix: "login" }), (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");

  const result = updateStore((store) => {
    const user = store.users.find((item) => item.phone === phone);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { error: "手机号或密码错误" };
    }
    createSession(res, store, user.id);
    return { user: publicUser(user) };
  });

  if (result.error) return res.status(401).json({ error: result.error });
  res.json(result);
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.wuhao_zhiyuan_session;
  updateStore((store) => {
    store.sessions = store.sessions.filter((item) => item.token !== token);
  });
  clearSession(res);
  res.json({ ok: true });
});

app.get("/api/campuses", (req, res) => {
  res.json({ campuses: readStore().campuses });
});

app.post("/api/profile/student", requireUser, (req, res) => {
  const studentProfile = compactProfile(sanitizeStudentProfile(req.body));
  const result = updateStore((store) => {
    const user = store.users.find((item) => item.id === req.user.id);
    user.studentProfile = { ...(user.studentProfile || {}), ...studentProfile };
    user.updatedAt = new Date().toISOString();
    return publicUser(user);
  });
  res.json({ user: result });
});

app.get("/api/mbti/questions", (req, res) => {
  res.json({
    questions: questions.map(([dimension, text], index) => ({ id: index, dimension, text })),
  });
});

app.get("/api/mbti/latest", requireUser, (req, res) => {
  const mbti = req.store.mbtiResults.filter((item) => item.userId === req.user.id).at(-1) || null;
  res.json({ mbti });
});

app.post("/api/mbti/submit", requireUser, (req, res) => {
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (answers.length !== questions.length) return res.status(400).json({ error: "请完成全部测评题目" });
  const scored = scoreMbti(answers);
  const result = updateStore((store) => {
    const mbti = {
      id: id("mbti"),
      userId: req.user.id,
      ...scored,
      createdAt: new Date().toISOString(),
    };
    store.mbtiResults.push(mbti);
    store.events.push({ type: "mbti_submitted", userId: req.user.id, mbtiId: mbti.id, createdAt: mbti.createdAt });
    return mbti;
  });
  res.json({ mbti: result });
});

function openingMessage(user, mbti) {
  const profile = user.studentProfile || {};
  const known = [profile.province, profile.subjects, profile.score, profile.rank].filter(Boolean).join("，");
  return `你好，${user.name}。我已经读取到你的 MBTI 倾向为 ${mbti.type}${known ? `，并看到你已填写：${known}` : ""}。请补充或确认考生省份、选科组合、总分、各科分数、位次、目标城市、专业兴趣、家庭预算，以及是否接受民办或中外合作。`;
}

app.post("/api/chat/message", requireUser, rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: "chat" }), async (req, res) => {
  const content = String(req.body.message || "").trim();
  if (!content) return res.status(400).json({ error: "请输入对话内容" });

  const mbti = req.store.mbtiResults.filter((item) => item.userId === req.user.id).at(-1);
  if (!mbti) return res.status(409).json({ error: "请先完成 MBTI 测评" });

  try {
    const store = readStore();
    let session = store.chatSessions.find((item) => item.userId === req.user.id && !item.closedAt);
    if (!session) {
      session = {
        id: id("chat"),
        userId: req.user.id,
        messages: [
          {
            role: "assistant",
            content: openingMessage(req.user, mbti),
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };
      store.chatSessions.push(session);
    }

    session.messages.push({ role: "user", content, createdAt: new Date().toISOString() });
    const systemPrompt = buildSystemPrompt({ user: req.user, mbti, campuses: store.campuses });
    let reply = await callDashScope({ systemPrompt, messages: session.messages });
    let source = "dashscope";
    if (!reply) {
      reply = mockReply({ message: content, user: req.user, mbti, campuses: store.campuses });
      source = "mock-ai";
    }
    session.messages.push({ role: "assistant", content: reply, source, createdAt: new Date().toISOString() });
    writeStore(store);
    const result = { session, reply, source };
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "大模型服务暂时不可用，请稍后重试" });
  }
});

app.get("/api/chat/current", requireUser, (req, res) => {
  const mbti = req.store.mbtiResults.filter((item) => item.userId === req.user.id).at(-1);
  let session = req.store.chatSessions.find((item) => item.userId === req.user.id && !item.closedAt);
  if (!session && mbti) {
    session = updateStore((store) => {
      const created = {
        id: id("chat"),
        userId: req.user.id,
        messages: [
          {
            role: "assistant",
            content: openingMessage(req.user, mbti),
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };
      store.chatSessions.push(created);
      return created;
    });
  }
  res.json({ session, mbti });
});

app.post("/api/report/generate", requireUser, rateLimit({ windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "report" }), async (req, res) => {
  const mbti = req.store.mbtiResults.filter((item) => item.userId === req.user.id).at(-1);
  const session = req.store.chatSessions.find((item) => item.userId === req.user.id && !item.closedAt);
  if (!mbti || !session) return res.status(409).json({ error: "请先完成测评和对话" });

  const report = updateStore((store) => {
    const item = {
      id: id("report"),
      userId: req.user.id,
      chatSessionId: session.id,
      mbtiId: mbti.id,
      createdAt: new Date().toISOString(),
    };
    store.reports.push(item);
    store.events.push({ type: "report_generated", userId: req.user.id, reportId: item.id, createdAt: item.createdAt });
    return item;
  });

  await generateReport({ report, user: req.user, mbti, messages: session.messages, campuses: req.store.campuses });
  res.json({ report, downloadUrl: `/reports/${report.id}.pdf` });
});

app.use("/reports", express.static(reportDir));

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const store = readStore();
  res.json({
    stats: createStats(store),
    users: toLeadRows(store).slice(-100).reverse(),
    campuses: store.campuses,
    backupDir,
  });
});

app.get("/api/admin/leads.csv", requireAdmin, (req, res) => {
  const store = readStore();
  const rows = toLeadRows(store);
  const headers = ["name", "gender", "phone", "source", "createdAt", "mbti", "reports", "province", "subjects", "score", "rank", "targetCities", "majorInterests", "budget", "acceptance"];
  sendCsv(
    res,
    headers,
    rows.map((row) => ({
      name: row.name,
      gender: row.gender,
      phone: row.phone,
      source: row.source,
      createdAt: row.createdAt,
      mbti: row.mbti,
      reports: row.reports,
      province: row.profile.province,
      subjects: row.profile.subjects,
      score: row.profile.score,
      rank: row.profile.rank,
      targetCities: row.profile.targetCities,
      majorInterests: row.profile.majorInterests,
      budget: row.profile.budget,
      acceptance: row.profile.acceptance,
    }))
  );
});

app.get("/api/admin/mbti.csv", requireAdmin, (req, res) => {
  const store = readStore();
  const users = userById(store);
  const headers = ["mbtiId", "userId", "name", "gender", "phone", "source", "province", "subjects", "score", "rank", "type", "scoreE", "scoreI", "scoreS", "scoreN", "scoreT", "scoreF", "scoreJ", "scoreP", "summary", "createdAt"];
  sendCsv(
    res,
    headers,
    store.mbtiResults.map((mbti) => {
      const user = users.get(mbti.userId) || {};
      const profile = user.studentProfile || {};
      return {
        mbtiId: mbti.id,
        userId: mbti.userId,
        name: user.name,
        gender: user.gender,
        phone: user.phone,
        source: user.source,
        province: profile.province,
        subjects: profile.subjects,
        score: profile.score,
        rank: profile.rank,
        type: mbti.type,
        scoreE: mbti.scores?.E,
        scoreI: mbti.scores?.I,
        scoreS: mbti.scores?.S,
        scoreN: mbti.scores?.N,
        scoreT: mbti.scores?.T,
        scoreF: mbti.scores?.F,
        scoreJ: mbti.scores?.J,
        scoreP: mbti.scores?.P,
        summary: mbti.summary,
        createdAt: mbti.createdAt,
      };
    })
  );
});

app.get("/api/admin/chats.csv", requireAdmin, (req, res) => {
  const store = readStore();
  const users = userById(store);
  const headers = ["sessionId", "userId", "name", "phone", "source", "sessionCreatedAt", "messageCreatedAt", "role", "messageSource", "content"];
  const rows = store.chatSessions.flatMap((session) => {
    const user = users.get(session.userId) || {};
    return (session.messages || []).map((message) => ({
      sessionId: session.id,
      userId: session.userId,
      name: user.name,
      phone: user.phone,
      source: user.source,
      sessionCreatedAt: session.createdAt,
      messageCreatedAt: message.createdAt,
      role: message.role,
      messageSource: message.source || "",
      content: message.content,
    }));
  });
  sendCsv(res, headers, rows);
});

app.get("/api/admin/reports.csv", requireAdmin, (req, res) => {
  const store = readStore();
  const users = userById(store);
  const headers = ["reportId", "userId", "name", "phone", "source", "chatSessionId", "mbtiId", "downloadUrl", "createdAt"];
  sendCsv(
    res,
    headers,
    store.reports.map((report) => {
      const user = users.get(report.userId) || {};
      return {
        reportId: report.id,
        userId: report.userId,
        name: user.name,
        phone: user.phone,
        source: user.source,
        chatSessionId: report.chatSessionId,
        mbtiId: report.mbtiId,
        downloadUrl: `/reports/${report.id}.pdf`,
        createdAt: report.createdAt,
      };
    })
  );
});

app.get("/api/admin/export.json", requireAdmin, (req, res) => {
  res.json(createFullExport(readStore()));
});

app.post("/api/admin/backup", requireAdmin, (req, res) => {
  const backupPath = backupStore();
  res.json({ ok: true, backupPath });
});

app.get(["/assessment/mbti", "/chat", "/profile", "/admin"], (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`wuhao-zhiyuan listening on http://0.0.0.0:${port}`);
  });
}

module.exports = { app, sanitizeStudentProfile, createStats };
