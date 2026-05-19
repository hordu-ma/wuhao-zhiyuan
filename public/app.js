const app = document.querySelector("#app");
const campusList = document.querySelector("[data-campus-list]");
const logoutButton = document.querySelector("[data-logout]");

const state = {
  me: null,
  campuses: [],
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function route() {
  return window.location.pathname;
}

function setHtml(html) {
  app.innerHTML = html;
}

async function loadCommon() {
  const [me, campusData] = await Promise.all([
    api("/api/me").catch(() => ({ user: null })),
    api("/api/campuses").catch(() => ({ campuses: [] })),
  ]);
  state.me = me;
  state.campuses = campusData.campuses || [];
  logoutButton.hidden = !state.me.user;
  renderCampuses();
}

function renderCampuses() {
  campusList.innerHTML = state.campuses
    .map(
      (campus) => `
        <article class="campus">
          <strong>${campus.name}</strong><br />
          电话：<a href="tel:${campus.phone}">${campus.phone}</a><br />
          微信：${campus.wechat}<br />
          地址：${campus.address}
        </article>
      `
    )
    .join("");
}

function authBox() {
  return `
    <section class="auth-box">
      <div class="auth-tabs">
        <button class="active" data-auth-tab="register">注册</button>
        <button data-auth-tab="login">登录</button>
      </div>
      <form data-auth-form>
        <div data-register-fields>
          <div class="field">
            <label>姓名</label>
            <input name="name" autocomplete="name" placeholder="请输入考生姓名" />
          </div>
          <div class="field">
            <label>性别</label>
            <select name="gender">
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>手机号</label>
          <input name="phone" inputmode="tel" autocomplete="tel" placeholder="11位手机号" />
        </div>
        <div class="field">
          <label>密码</label>
          <input name="password" type="password" autocomplete="current-password" placeholder="至少6位" />
        </div>
        <p class="error" data-auth-error></p>
        <button class="block" type="submit">注册并进入系统</button>
      </form>
    </section>
  `;
}

function mountAuth() {
  const box = document.querySelector(".auth-box");
  if (!box) return;
  let mode = "register";
  const form = box.querySelector("[data-auth-form]");
  const error = box.querySelector("[data-auth-error]");
  const registerFields = box.querySelector("[data-register-fields]");
  const submit = form.querySelector("button[type=submit]");

  box.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.authTab;
      box.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
      registerFields.hidden = mode === "login";
      submit.textContent = mode === "login" ? "登录并进入系统" : "注册并进入系统";
      error.textContent = "";
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      window.location.href = "/assessment/mbti";
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function home() {
  setHtml(`
    <section class="hero">
      <div class="hero-main">
        <p class="eyebrow">高考志愿填报 · 人格倾向 · 大模型辅助</p>
        <h1>把分数、性格、专业和未来路径放在同一张决策图上。</h1>
        <p class="lead">
          五好智学志愿填报辅助决策系统面向考生和家庭，先通过自研 16 型人格倾向问卷理解学生的学习与决策偏好，再结合分数、位次、选科、城市和专业意向，生成初步志愿建议与咨询报告。
        </p>
        <div class="steps">
          <article class="step"><strong>1. 注册登录</strong>使用手机号和密码建立个人档案，姓名与性别用于报告生成。</article>
          <article class="step"><strong>2. 完成测评</strong>提交 32 道人格倾向题，系统自动计算 MBTI 倾向。</article>
          <article class="step"><strong>3. AI初评</strong>输入分数与位次，获得院校、专业和风险提示。</article>
        </div>
        <a class="button" href="/assessment/mbti">进入系统</a>
        <p class="notice">请先注册并登录后使用。系统建议仅作初步辅助，正式填报前建议人工复核。</p>
      </div>
      <aside>
        ${
          state.me.user
            ? `<section class="auth-box"><h2>${state.me.user.name}，欢迎回来</h2><p class="lead">可继续测评、进入对话或查看报告。</p><a class="button block" href="/assessment/mbti">进入系统</a><br /><a class="button secondary block" href="/profile">个人中心</a></section>`
            : authBox()
        }
      </aside>
    </section>
  `);
  mountAuth();
}

async function requireLogin() {
  if (!state.me.user) {
    window.location.href = "/";
    return false;
  }
  return true;
}

async function mbtiPage() {
  if (!(await requireLogin())) return;
  const data = await api("/api/mbti/questions");
  setHtml(`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>16型人格倾向测评</h1>
          <p class="lead">请选择每句话与自己的符合程度。提交后将直接进入志愿对话，完整结果会整合进报告。</p>
        </div>
      </div>
      <form class="questions" data-mbti-form>
        ${data.questions
          .map(
            (question, index) => `
              <article class="question">
                <strong>${index + 1}. ${question.text}</strong>
                <div class="scale">
                  ${[1, 2, 3, 4, 5]
                    .map(
                      (value) => `
                        <label>
                          <input type="radio" name="q${index}" value="${value}" required />
                          ${value}
                        </label>
                      `
                    )
                    .join("")}
                </div>
              </article>
            `
          )
          .join("")}
        <p class="error" data-mbti-error></p>
        <button type="submit">提交测评并进入对话</button>
      </form>
    </section>
  `);

  document.querySelector("[data-mbti-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("[data-mbti-error]");
    const answers = data.questions.map((_, index) => Number(new FormData(event.currentTarget).get(`q${index}`)));
    try {
      await api("/api/mbti/submit", { method: "POST", body: JSON.stringify({ answers }) });
      window.location.href = "/chat";
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function messageHtml(message) {
  return `<div class="message ${message.role === "user" ? "user" : "assistant"}">${escapeHtml(message.content)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function chatPage() {
  if (!(await requireLogin())) return;
  const data = await api("/api/chat/current");
  if (!data.mbti) {
    window.location.href = "/assessment/mbti";
    return;
  }
  setHtml(`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>AI志愿对话</h1>
          <p class="lead">系统已注入姓名、性别和 MBTI 结果。请尽量一次性提供完整分数和位次信息。</p>
        </div>
        <button data-report>生成咨询报告</button>
      </div>
      <div class="chat-layout">
        <section class="chat-window">
          <div class="messages" data-messages>${(data.session?.messages || []).map(messageHtml).join("")}</div>
          <form class="chat-form" data-chat-form>
            <textarea name="message" placeholder="例如：山东，物化生，总分612，语文118，数学125，英语130，位次约28000，想去青岛或济南，偏向计算机和自动化，家庭可接受公办和中外合作..."></textarea>
            <p class="error" data-chat-error></p>
            <button type="submit">发送</button>
          </form>
        </section>
        <aside class="panel">
          <h2>当前测评</h2>
          <p><strong>${data.mbti.type}</strong></p>
          <p>${data.mbti.summary}</p>
          <p class="notice">MBTI结果用于辅助理解偏好，正式志愿方案仍需结合位次、招生计划和人工复核。</p>
        </aside>
      </div>
    </section>
  `);

  const messages = document.querySelector("[data-messages]");
  const form = document.querySelector("[data-chat-form]");
  const error = document.querySelector("[data-chat-error]");
  messages.scrollTop = messages.scrollHeight;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const textarea = form.elements.message;
    const content = textarea.value.trim();
    if (!content) return;
    messages.insertAdjacentHTML("beforeend", messageHtml({ role: "user", content }));
    textarea.value = "";
    messages.insertAdjacentHTML("beforeend", `<div class="message assistant" data-loading>正在生成建议...</div>`);
    messages.scrollTop = messages.scrollHeight;
    try {
      const result = await api("/api/chat/message", { method: "POST", body: JSON.stringify({ message: content }) });
      document.querySelector("[data-loading]")?.remove();
      messages.insertAdjacentHTML("beforeend", messageHtml({ role: "assistant", content: result.reply }));
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      document.querySelector("[data-loading]")?.remove();
      error.textContent = err.message;
    }
  });

  document.querySelector("[data-report]").addEventListener("click", async () => {
    try {
      const result = await api("/api/report/generate", { method: "POST", body: "{}" });
      window.location.href = result.downloadUrl;
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

async function profilePage() {
  if (!(await requireLogin())) return;
  const data = await api("/api/me");
  setHtml(`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>个人中心</h1>
          <p class="lead">查看基础信息、最近测评和历史咨询报告。</p>
        </div>
      </div>
      <div class="profile-grid">
        <article class="profile-row">
          <h2>基础信息</h2>
          <p>姓名：${data.user.name}</p>
          <p>性别：${data.user.gender}</p>
          <p>手机号：${data.user.phone}</p>
        </article>
        <article class="profile-row">
          <h2>最近测评</h2>
          ${
            data.mbti
              ? `<p>类型：<strong>${data.mbti.type}</strong></p><p>${data.mbti.summary}</p>`
              : `<p>尚未完成测评。</p>`
          }
          <a class="button secondary" href="/assessment/mbti">重新测评</a>
        </article>
        <article class="profile-row">
          <h2>历史报告</h2>
          ${
            data.reports.length
              ? data.reports.map((report) => `<p><a href="/reports/${report.id}.pdf">${new Date(report.createdAt).toLocaleString("zh-CN")} 咨询报告</a></p>`).join("")
              : "<p>尚未生成报告。</p>"
          }
        </article>
        <article class="profile-row">
          <h2>继续使用</h2>
          <p>完成测评后可进入 AI志愿对话，生成新的咨询报告。</p>
          <a class="button" href="/chat">进入对话</a>
        </article>
      </div>
    </section>
  `);
}

logoutButton.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  window.location.href = "/";
});

await loadCommon();

if (route() === "/assessment/mbti") {
  await mbtiPage();
} else if (route() === "/chat") {
  await chatPage();
} else if (route() === "/profile") {
  await profilePage();
} else {
  home();
}
