const fs = require("fs");
const path = require("path");

const examYear = Number(process.env.EXAM_YEAR || 2026);
const defaultDataPath = path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "admissions.json");

function dataPath() {
  return process.env.ADMISSIONS_DATA_PATH || defaultDataPath;
}

function toNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeRecord(record = {}) {
  return {
    province: record.province || record.enrollProvince || "",
    schoolName: record.schoolName || record.school_name || "",
    majorName: record.majorName || record.major_name || "",
    city: record.city || "",
    schoolLevel: record.schoolLevel || record.school_level || "",
    subjectRequirements: record.subjectRequirements || record.subject_requirements || "",
    planCount: toNumber(record.planCount ?? record.plan_count),
    tuition: record.tuition || "",
    admissionYear: toNumber(record.admissionYear ?? record.admission_year),
    minScore: toNumber(record.minScore ?? record.min_score),
    minRank: toNumber(record.minRank ?? record.min_rank),
    avgRank: toNumber(record.avgRank ?? record.avg_rank),
    sourceName: record.sourceName || record.source_name || "",
    sourceUrl: record.sourceUrl || record.source_url || "",
    updatedAt: record.updatedAt || record.updated_at || "",
  };
}

function loadAdmissionsData() {
  const filePath = dataPath();
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      filePath,
      examYear,
      dataMode: "missing",
      dataYear: null,
      updatedAt: "",
      sourceName: "",
      sourceUrl: "",
      records: [],
      warning: "未配置招生数据文件，当前只能给方向性建议和数据补充清单。",
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const records = Array.isArray(parsed) ? parsed : parsed.records;
    return {
      ok: true,
      filePath,
      examYear: Number(parsed.examYear || parsed.exam_year || examYear),
      dataMode: parsed.dataMode || parsed.data_mode || "historical_reference",
      dataYear: toNumber(parsed.dataYear ?? parsed.data_year),
      updatedAt: parsed.updatedAt || parsed.updated_at || "",
      sourceName: parsed.sourceName || parsed.source_name || "",
      sourceUrl: parsed.sourceUrl || parsed.source_url || "",
      records: (Array.isArray(records) ? records : []).map(normalizeRecord).filter((record) => record.schoolName && record.majorName),
      warning: "",
    };
  } catch (error) {
    return {
      ok: false,
      filePath,
      examYear,
      dataMode: "invalid",
      dataYear: null,
      updatedAt: "",
      sourceName: "",
      sourceUrl: "",
      records: [],
      warning: `招生数据文件解析失败：${error.message}`,
    };
  }
}

const subjectAliases = [
  ["物理", "物"],
  ["化学", "化"],
  ["生物", "生"],
  ["历史", "史"],
  ["地理", "地"],
  ["政治", "政"],
];

// 先按完整科目名解析，再用短别名匹配剩余字符，避免「生物」被误判为含「物理」。
function parseSelectedSubjects(subjects) {
  let rest = String(subjects || "");
  const set = new Set();
  for (const [full] of subjectAliases) {
    if (rest.includes(full)) {
      set.add(full);
      rest = rest.split(full).join(" ");
    }
  }
  for (const [full, short] of subjectAliases) {
    if (!set.has(full) && rest.includes(short)) set.add(full);
  }
  return set;
}

function subjectMatches(requirements, subjects) {
  const required = String(requirements || "");
  if (!required || /不限|无要求/.test(required)) return true;
  const selectedSet = parseSelectedSubjects(subjects);
  return subjectAliases.every(([full]) => !required.includes(full) || selectedSet.has(full));
}

function textScore(record, profile) {
  const cities = String(profile.targetCities || "");
  const majors = String(profile.majorInterests || "");
  let score = 0;
  if (record.city && cities.includes(record.city)) score += 3;
  if (record.majorName && majors && majors.split(/[、,，\s]+/).some((item) => item && record.majorName.includes(item))) score += 4;
  if (/985|211|双一流/.test(record.schoolLevel)) score += 1;
  return score;
}

function bucketByRank(record, rank) {
  if (!rank || !record.minRank) return "reference";
  const ratio = (record.minRank - rank) / rank;
  if (ratio < -0.15) return "rush";
  if (ratio <= 0.15) return "stable";
  return "safety";
}

function summarizeRecord(record) {
  return {
    schoolName: record.schoolName,
    majorName: record.majorName,
    city: record.city,
    subjectRequirements: record.subjectRequirements,
    admissionYear: record.admissionYear,
    minScore: record.minScore,
    minRank: record.minRank,
    planCount: record.planCount,
    tuition: record.tuition,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
  };
}

function retrieveAdmissionContext(profile = {}, limitPerBucket = 5) {
  const data = loadAdmissionsData();
  const rank = toNumber(profile.rank);
  const province = String(profile.province || "");
  const buckets = { rush: [], stable: [], safety: [], reference: [] };

  data.records
    .filter((record) => !province || !record.province || record.province === province)
    .filter((record) => subjectMatches(record.subjectRequirements, profile.subjects))
    .map((record) => ({
      record,
      bucket: bucketByRank(record, rank),
      score: textScore(record, profile),
    }))
    .sort((left, right) => right.score - left.score || Math.abs((left.record.minRank || rank || 0) - (rank || 0)) - Math.abs((right.record.minRank || rank || 0) - (rank || 0)))
    .forEach((item) => {
      if (buckets[item.bucket].length < limitPerBucket) buckets[item.bucket].push(summarizeRecord(item.record));
    });

  const totalMatches = Object.values(buckets).reduce((sum, items) => sum + items.length, 0);
  const warnings = [];
  if (data.warning) warnings.push(data.warning);
  if (data.ok && !totalMatches) warnings.push("招生数据文件已加载，但没有匹配当前省份、选科和偏好的记录。");
  const referenceYear = data.dataYear || data.examYear;
  if (data.ok && referenceYear < examYear) warnings.push(`当前使用 ${referenceYear} 年历史录取数据辅助模拟 ${examYear} 年填报，不能当作 ${examYear} 年正式录取结果。`);

  return {
    examYear,
    dataFile: data.filePath,
    dataLoaded: data.ok,
    dataMode: data.dataMode,
    dataExamYear: data.examYear,
    dataYear: data.dataYear,
    dataUpdatedAt: data.updatedAt,
    sourceName: data.sourceName,
    sourceUrl: data.sourceUrl,
    warnings,
    profile: {
      province: profile.province || "",
      subjects: profile.subjects || "",
      score: profile.score || "",
      rank: profile.rank || "",
      targetCities: profile.targetCities || "",
      majorInterests: profile.majorInterests || "",
    },
    candidates: buckets,
  };
}

function formatAdmissionContext(context) {
  return JSON.stringify(context, null, 2);
}

function hasAdmissionCandidates(context = {}) {
  return Object.values(context.candidates || {}).some((items) => Array.isArray(items) && items.length > 0);
}

module.exports = { examYear, loadAdmissionsData, retrieveAdmissionContext, formatAdmissionContext, hasAdmissionCandidates };
