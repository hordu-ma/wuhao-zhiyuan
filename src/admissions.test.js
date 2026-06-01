const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

test("returns a safe empty context when admissions data is missing", () => {
  const previousPath = process.env.ADMISSIONS_DATA_PATH;
  process.env.ADMISSIONS_DATA_PATH = path.join(os.tmpdir(), `missing-admissions-${Date.now()}.json`);
  delete require.cache[require.resolve("./admissions")];
  const { retrieveAdmissionContext, hasAdmissionCandidates } = require("./admissions");

  const context = retrieveAdmissionContext({ province: "山东", subjects: "物化生", rank: "28000" });

  assert.equal(context.examYear, 2026);
  assert.equal(context.dataLoaded, false);
  assert.equal(hasAdmissionCandidates(context), false);
  assert.equal(context.warnings.some((warning) => warning.includes("未配置招生数据文件")), true);

  if (previousPath) process.env.ADMISSIONS_DATA_PATH = previousPath;
  else delete process.env.ADMISSIONS_DATA_PATH;
  delete require.cache[require.resolve("./admissions")];
});

test("retrieves and buckets admission records by rank", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "admissions-test-"));
  const filePath = path.join(tempDir, "admissions.json");
  const previousPath = process.env.ADMISSIONS_DATA_PATH;
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      examYear: 2025,
      updatedAt: "2026-06-01T00:00:00.000Z",
      sourceName: "official-test",
      records: [
        { province: "山东", schoolName: "冲刺大学", majorName: "计算机科学与技术", city: "济南", subjectRequirements: "物理,化学", admissionYear: 2025, minRank: 23000 },
        { province: "山东", schoolName: "稳妥大学", majorName: "自动化", city: "青岛", subjectRequirements: "物理,化学", admissionYear: 2025, minRank: 29000 },
        { province: "山东", schoolName: "保底大学", majorName: "电子信息工程", city: "济南", subjectRequirements: "物理", admissionYear: 2025, minRank: 36000 },
      ],
    })
  );
  process.env.ADMISSIONS_DATA_PATH = filePath;
  delete require.cache[require.resolve("./admissions")];
  const { retrieveAdmissionContext, hasAdmissionCandidates } = require("./admissions");

  const context = retrieveAdmissionContext({
    province: "山东",
    subjects: "物化生",
    rank: "28000",
    targetCities: "济南、青岛",
    majorInterests: "计算机、自动化、电子信息",
  });

  assert.equal(context.dataLoaded, true);
  assert.equal(context.candidates.rush[0].schoolName, "冲刺大学");
  assert.equal(context.candidates.stable[0].schoolName, "稳妥大学");
  assert.equal(context.candidates.safety[0].schoolName, "保底大学");
  assert.equal(hasAdmissionCandidates(context), true);
  assert.equal(context.warnings.some((warning) => warning.includes("历史参考")), true);

  if (previousPath) process.env.ADMISSIONS_DATA_PATH = previousPath;
  else delete process.env.ADMISSIONS_DATA_PATH;
  delete require.cache[require.resolve("./admissions")];
});
