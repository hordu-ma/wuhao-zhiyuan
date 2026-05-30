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
  if (!response.ok) {
    const error = new Error(data.error || "请求失败");
    error.data = data;
    throw error;
  }
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
        <label class="check-row" data-register-field>
          <input name="privacyConsent" type="checkbox" />
          <span>我已了解手机号、测评答案、对话内容和报告将用于生成志愿咨询建议，并同意五好生涯用于后续人工复核与咨询联系。</span>
        </label>
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
  const registerFields = box.querySelectorAll("[data-register-fields], [data-register-field]");
  const submit = form.querySelector("button[type=submit]");

  box.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.authTab;
      box.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
      registerFields.forEach((item) => {
        item.hidden = mode === "login";
      });
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
          五好生涯志愿填报辅助决策系统面向考生和家庭，先通过自研 16 型人格倾向问卷理解学生的学习与决策偏好，再结合分数、位次、选科、城市和专业意向，生成初步志愿建议与咨询报告。
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

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

const profileLabels = {
  province: "省份",
  subjects: "选科",
  score: "总分",
  rank: "位次",
  targetCities: "目标城市",
  majorInterests: "专业兴趣",
  budget: "家庭预算",
  acceptance: "民办/中外合作接受度",
};

const reportRequiredFields = ["province", "subjects", "score", "rank", "targetCities", "majorInterests"];

function missingProfileLabels(profile = {}, fields = reportRequiredFields) {
  return fields.filter((field) => !profile[field]).map((field) => profileLabels[field]);
}

function profileCompleteness(profile = {}) {
  const fields = Object.keys(profileLabels);
  const filled = fields.filter((field) => profile[field]).length;
  return `${filled}/${fields.length}`;
}

async function chatPage() {
  if (!(await requireLogin())) return;
  const data = await api("/api/chat/current");
  if (!data.mbti) {
    window.location.href = "/assessment/mbti";
    return;
  }
  const profile = state.me.user.studentProfile || {};
  const missingLabels = missingProfileLabels(profile);
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
          <details class="profile-capture" open>
            <summary>考生关键信息</summary>
            <form class="profile-form" data-profile-form>
              <div class="form-grid">
                <input name="province" placeholder="省份，例如山东" value="${escapeAttr(profile.province || "")}" />
                <input name="subjects" placeholder="选科，例如物化生" value="${escapeAttr(profile.subjects || "")}" />
                <input name="score" placeholder="总分，例如612" value="${escapeAttr(profile.score || "")}" />
                <input name="rank" placeholder="位次，例如28000" value="${escapeAttr(profile.rank || "")}" />
                <input name="targetCities" placeholder="目标城市，例如济南、青岛" value="${escapeAttr(profile.targetCities || "")}" />
                <input name="majorInterests" placeholder="专业兴趣，例如计算机、自动化" value="${escapeAttr(profile.majorInterests || "")}" />
                <input name="budget" placeholder="家庭预算" value="${escapeAttr(profile.budget || "")}" />
                <input name="acceptance" placeholder="民办/中外合作接受度" value="${escapeAttr(profile.acceptance || "")}" />
              </div>
              <p class="notice" data-profile-status>先保存关键信息，再开始对话，报告会自动带入。</p>
              <button type="submit" class="secondary">保存考生信息</button>
            </form>
          </details>
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
          <h2>信息完整度</h2>
          <p><strong>${profileCompleteness(profile)}</strong></p>
          <p class="notice" data-profile-gap>${missingLabels.length ? `报告前建议补充：${missingLabels.join("、")}` : "核心信息已具备，可进入报告生成。"}</p>
          <p class="notice">MBTI结果用于辅助理解偏好，正式志愿方案仍需结合位次、招生计划和人工复核。</p>
        </aside>
      </div>
    </section>
  `);

  const messages = document.querySelector("[data-messages]");
  const profileForm = document.querySelector("[data-profile-form]");
  const profileStatus = document.querySelector("[data-profile-status]");
  const profileGap = document.querySelector("[data-profile-gap]");
  const form = document.querySelector("[data-chat-form]");
  const error = document.querySelector("[data-chat-error]");
  messages.scrollTop = messages.scrollHeight;

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(profileForm).entries());
    try {
      const result = await api("/api/profile/student", { method: "POST", body: JSON.stringify(payload) });
      state.me.user = result.user;
      const missing = missingProfileLabels(result.user.studentProfile || {});
      profileStatus.textContent = `已保存，当前完整度 ${profileCompleteness(result.user.studentProfile || {})}。`;
      profileGap.textContent = missing.length ? `报告前建议补充：${missing.join("、")}` : "核心信息已具备，可进入报告生成。";
    } catch (err) {
      profileStatus.textContent = err.message;
    }
  });

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
      if (err.data?.code === "PROFILE_INCOMPLETE") {
        const missing = (err.data.missingFields || []).map((item) => item.label).join("、");
        const confirmed = window.confirm(`当前缺少：${missing}。确认先生成初版报告吗？`);
        if (!confirmed) {
          error.textContent = "请先补充关键信息后再生成报告。";
          return;
        }
        const result = await api("/api/report/generate", { method: "POST", body: JSON.stringify({ confirmIncomplete: true }) });
        window.location.href = result.downloadUrl;
        return;
      }
      error.textContent = err.message;
    }
  });
}

async function profilePage() {
  if (!(await requireLogin())) return;
  const data = await api("/api/me");
  const profile = data.user.studentProfile || {};
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
          <p>来源：${data.user.source || "未记录"}</p>
        </article>
        <article class="profile-row">
          <h2>考生信息</h2>
          <p>省份：${data.user.studentProfile?.province || "待补充"}</p>
          <p>选科：${data.user.studentProfile?.subjects || "待补充"}</p>
          <p>总分：${data.user.studentProfile?.score || "待补充"}</p>
          <p>位次：${data.user.studentProfile?.rank || "待补充"}</p>
          <p>目标城市：${data.user.studentProfile?.targetCities || "待补充"}</p>
          <p>专业兴趣：${data.user.studentProfile?.majorInterests || "待补充"}</p>
          <p>完整度：${profileCompleteness(profile)}</p>
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
          <p>完成测评后可继续上次 AI志愿对话，或在补齐关键信息后生成新的咨询报告。</p>
          <div class="actions">
            <a class="button" href="/chat">继续对话</a>
            <a class="button secondary" href="/chat">生成报告</a>
          </div>
        </article>
      </div>
    </section>
  `);
}

async function adminPage() {
  setHtml(`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>运营后台</h1>
          <p class="lead">查看注册、测评、对话、报告和线索数据。访问令牌由生产环境 ADMIN_TOKEN 控制。</p>
        </div>
      </div>
      <section class="admin-login">
        <input data-admin-token placeholder="输入后台访问令牌" value="${escapeAttr(localStorage.getItem("wuhaoAdminToken") || "")}" />
        <input data-admin-source placeholder="来源筛选" value="${escapeAttr(localStorage.getItem("wuhaoAdminSource") || "")}" />
        <select data-admin-status>
          <option value="">全部线索</option>
          <option value="profileIncomplete">信息待补充</option>
          <option value="profileComplete">信息较完整</option>
          <option value="mbtiDone">已完成测评</option>
          <option value="reportDone">已生成报告</option>
          <option value="noReport">未生成报告</option>
        </select>
        <select data-admin-campus>
          <option value="">全部校区</option>
          ${state.campuses.map((campus) => `<option value="${escapeAttr(campus.id || campus.name)}">${escapeHtml(campus.name)}</option>`).join("")}
        </select>
        <button data-admin-load>加载数据</button>
        <a class="button secondary" data-admin-export href="#">导出线索 CSV</a>
        <button class="secondary" data-admin-backup>备份数据</button>
      </section>
      <p class="error" data-admin-error></p>
      <section class="stats-grid" data-admin-stats></section>
      <section class="profile-row">
        <h2>最近线索</h2>
        <div class="table-wrap" data-admin-users></div>
      </section>
    </section>
  `);

  const tokenInput = document.querySelector("[data-admin-token]");
  const sourceInput = document.querySelector("[data-admin-source]");
  const statusSelect = document.querySelector("[data-admin-status]");
  const campusSelect = document.querySelector("[data-admin-campus]");
  const error = document.querySelector("[data-admin-error]");
  const statsBox = document.querySelector("[data-admin-stats]");
  const usersBox = document.querySelector("[data-admin-users]");
  const exportLink = document.querySelector("[data-admin-export]");
  statusSelect.value = localStorage.getItem("wuhaoAdminStatus") || "";
  campusSelect.value = localStorage.getItem("wuhaoAdminCampus") || "";

  function adminQuery(token) {
    const params = new URLSearchParams({ token });
    const source = sourceInput.value.trim();
    const status = statusSelect.value;
    const campus = campusSelect.value;
    if (source) params.set("source", source);
    if (status) params.set("status", status);
    if (campus) params.set("campus", campus);
    return params.toString();
  }

  async function loadAdmin() {
    error.textContent = "";
    const token = tokenInput.value.trim();
    localStorage.setItem("wuhaoAdminToken", token);
    localStorage.setItem("wuhaoAdminSource", sourceInput.value.trim());
    localStorage.setItem("wuhaoAdminStatus", statusSelect.value);
    localStorage.setItem("wuhaoAdminCampus", campusSelect.value);
    const query = adminQuery(token);
    exportLink.href = `/api/admin/leads.csv?${query}`;
    try {
      const data = await api(`/api/admin/summary?${query}`, { headers: { "x-admin-token": token } });
      statsBox.innerHTML = Object.entries({ ...data.stats, matched: data.filters?.matched || 0 })
        .map(([key, value]) => `<article class="stat"><strong>${value}</strong><span>${key}</span></article>`)
        .join("");
      usersBox.innerHTML = `
        <table>
          <thead><tr><th>姓名</th><th>手机号</th><th>来源</th><th>推荐校区</th><th>完整度</th><th>最近对话</th><th>建议摘要</th><th>MBTI</th><th>报告</th><th>省份/分数/位次</th></tr></thead>
          <tbody>
            ${data.users
              .map(
                (user) => `
                  <tr>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.phone)}</td>
                    <td>${escapeHtml(user.source || "")}</td>
                    <td>${escapeHtml(user.recommendedCampus || "")}</td>
                    <td>${escapeHtml(user.profileCompleteness || "")}</td>
                    <td>${escapeHtml(user.lastChatAt ? new Date(user.lastChatAt).toLocaleString("zh-CN") : "")}</td>
                    <td>${escapeHtml(user.adviceSummary || "")}</td>
                    <td>${escapeHtml(user.mbti || "")}</td>
                    <td>${user.reports}</td>
                    <td>${escapeHtml([user.profile.province, user.profile.score, user.profile.rank].filter(Boolean).join(" / "))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      `;
    } catch (err) {
      error.textContent = err.message;
    }
  }

  document.querySelector("[data-admin-load]").addEventListener("click", loadAdmin);
  document.querySelector("[data-admin-backup]").addEventListener("click", async () => {
    try {
      const token = tokenInput.value.trim();
      const data = await api("/api/admin/backup", { method: "POST", headers: { "x-admin-token": token }, body: "{}" });
      error.textContent = `已备份：${data.backupPath}`;
    } catch (err) {
      error.textContent = err.message;
    }
  });
  if (tokenInput.value.trim()) await loadAdmin();
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
} else if (route() === "/admin") {
  await adminPage();
} else {
  home();
}
