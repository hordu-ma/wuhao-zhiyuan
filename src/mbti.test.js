const test = require("node:test");
const assert = require("node:assert/strict");
const { questions, scoreMbti } = require("./mbti");

test("scores all MBTI dimensions and returns a four-letter type", () => {
  const answers = questions.map(() => 5);
  const result = scoreMbti(answers);

  assert.equal(questions.length, 32);
  assert.match(result.type, /^[EISNTFJP]{4}$/);
  assert.equal(result.type.length, 4);
  assert.ok(result.summary.length > 0);
});
