const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { readStore, writeStore, updateStore } = require("./store");
const { questions, scoreMbti } = require("./mbti");
const { buildSystemPrompt, callDashScope, mockReply } = require("./ai");
const { generateReport, reportDir } = require("./report");
const { hashPassword, verifyPassword, id, createSession, clearSession, getCurrentUser, publicUser } = require("./auth");

const app = express();
const port = Number(process.env.PORT || 18082);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || "dev-session-secret"));
app.use(express.static(path.join(__dirname, "..", "public")));

function requireUser(req, res, next) {
  const store = readStore();
  const user = getCurrentUser(req, store);
  if (!user) return res.status(401).json({ error: "请先注册或登录" });
  req.store = store;
  req.user = user;
  next();
}

app.get("/api/me", (req, res) => {
  const store = readStore();
  const user = getCurrentUser(req, store);
  const mbti = user ? store.mbtiResults.filter((item) => item.userId === user.id).at(-1) || null : null;
  const reports = user ? store.reports.filter((item) => item.userId === user.id) : [];
  res.json({ user: publicUser(user), mbti, reports });
});

app.post("/api/auth/register", (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  const name = String(req.body.name || "").trim();
  const gender = String(req.body.gender || "").trim();

  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: "请输入 11 位手机号" });
  if (password.length < 6) return res.status(400).json({ error: "密码至少 6 位" });
  if (!name) return res.status(400).json({ error: "请输入姓名" });
  if (!gender) return res.status(400).json({ error: "请选择性别" });

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
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    const token = createSession(res, store, user.id);
    return { user: publicUser(user), token };
  });

  if (result.error) return res.status(409).json({ error: result.error });
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
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
    return mbti;
  });
  res.json({ mbti: result });
});

app.post("/api/chat/message", requireUser, async (req, res) => {
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
            content: `你好，${req.user.name}。我已经读取到你的 MBTI 倾向为 ${mbti.type}。请先提供考生所在省份、选科组合、总分、各科分数、位次、目标城市、专业兴趣、家庭预算，以及是否接受民办或中外合作。`,
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
            content: `你好，${req.user.name}。我已经读取到你的 MBTI 倾向为 ${mbti.type}。请先提供考生所在省份、选科组合、总分、各科分数、位次、目标城市、专业兴趣、家庭预算，以及是否接受民办或中外合作。`,
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

app.post("/api/report/generate", requireUser, async (req, res) => {
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
    return item;
  });

  await generateReport({ report, user: req.user, mbti, messages: session.messages, campuses: req.store.campuses });
  res.json({ report, downloadUrl: `/reports/${report.id}.pdf` });
});

app.use("/reports", express.static(reportDir));

app.get(["/assessment/mbti", "/chat", "/profile"], (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`wuhao-zhiyuan listening on http://0.0.0.0:${port}`);
});
