const test = require("node:test");
const assert = require("node:assert/strict");
const { questions, scoreMbti } = require("./mbti");

test("scores all MBTI dimensions and returns a four-letter type", () => {
  const answers = questions.map(() => 5);
  const result = scoreMbti(answers);

  assert.equal(questions.length, 48);
  assert.match(result.type, /^[EISNTFJP]{4}$/);
  assert.equal(result.type.length, 4);
  assert.ok(result.summary.length > 0);
  assert.equal(result.preferences.length, 4);
  assert.deepEqual(
    result.preferences.map((item) => item.dimension),
    ["EI", "SN", "TF", "JP"]
  );
});

test("scores direction by agreement, not raw value", () => {
  // 对每道题，赞同本极给 5 分、反对则给 1 分，应整体推向该极。
  const answers = questions.map(([dimension, , pole]) => {
    const firstPole = dimension[0];
    return pole === firstPole ? 5 : 1;
  });
  const result = scoreMbti(answers);

  assert.equal(result.type, "ESTJ");
  assert.ok(result.scores.E > result.scores.I);
  assert.ok(result.scores.S > result.scores.N);
  assert.ok(result.scores.T > result.scores.F);
  assert.ok(result.scores.J > result.scores.P);
  // 反对一极不应给该极加分，而应转移到对立极。
  assert.equal(result.scores.I, 0);
});

test("keeps each MBTI pole evenly represented", () => {
  const counts = questions.reduce((acc, [, , pole]) => {
    acc[pole] = (acc[pole] || 0) + 1;
    return acc;
  }, {});

  assert.deepEqual(counts, {
    E: 6,
    I: 6,
    S: 6,
    N: 6,
    T: 6,
    F: 6,
    J: 6,
    P: 6,
  });
});
