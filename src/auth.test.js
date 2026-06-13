const test = require("node:test");
const assert = require("node:assert/strict");
const { SESSION_TTL_MS, getCurrentUser, pruneExpiredSessions, publicUser } = require("./auth");

function buildStore(sessionCreatedAt) {
  return {
    users: [{ id: "user_1", phone: "13900000001", name: "测试", passwordHash: "x" }],
    sessions: [{ token: "tok_1", userId: "user_1", createdAt: sessionCreatedAt }],
  };
}

test("ignores sessions older than the TTL", () => {
  const req = { cookies: { wuhao_zhiyuan_session: "tok_1" } };

  const fresh = buildStore(new Date().toISOString());
  assert.equal(getCurrentUser(req, fresh)?.id, "user_1");

  const expiredAt = new Date(Date.now() - SESSION_TTL_MS - 1000).toISOString();
  const expired = buildStore(expiredAt);
  assert.equal(getCurrentUser(req, expired), null);
});

test("prunes expired sessions and keeps fresh ones", () => {
  const store = {
    sessions: [
      { token: "fresh", userId: "user_1", createdAt: new Date().toISOString() },
      { token: "stale", userId: "user_1", createdAt: new Date(Date.now() - SESSION_TTL_MS - 1000).toISOString() },
    ],
  };
  const removed = pruneExpiredSessions(store);
  assert.equal(removed, 1);
  assert.deepEqual(store.sessions.map((session) => session.token), ["fresh"]);
});

test("publicUser never leaks the password hash", () => {
  const safe = publicUser({ id: "user_1", phone: "13900000001", name: "测试", passwordHash: "secret" });
  assert.equal(safe.passwordHash, undefined);
});
