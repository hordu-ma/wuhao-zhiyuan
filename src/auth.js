const crypto = require("crypto");

const SESSION_COOKIE = "wuhao_zhiyuan_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: SESSION_TTL_MS,
};

function isSessionExpired(session) {
  if (!session) return true;
  const createdAt = new Date(session.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt >= SESSION_TTL_MS;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, "hex");
  return actual.length === candidate.length && crypto.timingSafeEqual(candidate, actual);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function createSession(res, store, userId) {
  const token = id("sess");
  store.sessions.push({
    token,
    userId,
    createdAt: new Date().toISOString(),
  });
  res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
  return token;
}

function clearSession(res) {
  res.clearCookie(SESSION_COOKIE);
}

function getCurrentUser(req, store) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = store.sessions.find((item) => item.token === token);
  if (!session || isSessionExpired(session)) return null;
  return store.users.find((item) => item.id === session.userId) || null;
}

function pruneExpiredSessions(store) {
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((session) => !isSessionExpired(session));
  return before - store.sessions.length;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    gender: user.gender,
    source: user.source,
    studentProfile: user.studentProfile || {},
    createdAt: user.createdAt,
  };
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashPassword,
  verifyPassword,
  id,
  createSession,
  clearSession,
  getCurrentUser,
  pruneExpiredSessions,
  publicUser,
};
