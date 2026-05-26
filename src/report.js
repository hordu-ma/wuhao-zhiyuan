const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const reportDir = path.join(__dirname, "..", "reports");
const fontPath = "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf";

function ensureReportDir() {
  fs.mkdirSync(reportDir, { recursive: true });
}

function drawWatermark(doc) {
  const { width, height } = doc.page;
  doc.save();
  doc.rotate(-28, { origin: [width / 2, height / 2] });
  doc.fillColor("#d7e3dd").opacity(0.22).fontSize(64).text("五好生涯", -40, height / 2 - 40, {
    align: "center",
    width: width + 120,
  });
  doc.restore();
  doc.opacity(1).fillColor("#14211b");
}

function addSection(doc, title, body) {
  doc.moveDown(0.8);
  doc.fontSize(15).fillColor("#1b4d3e").text(title);
  doc.moveDown(0.25);
  doc.fontSize(10.5).fillColor("#26352f").text(body || "待补充", {
    lineGap: 4,
  });
}

function formatProfile(profile = {}) {
  return [
    `省份：${profile.province || "待补充"}`,
    `选科：${profile.subjects || "待补充"}`,
    `总分：${profile.score || "待补充"}`,
    `位次：${profile.rank || "待补充"}`,
    `目标城市：${profile.targetCities || "待补充"}`,
    `专业兴趣：${profile.majorInterests || "待补充"}`,
    `家庭预算：${profile.budget || "待补充"}`,
    `民办/中外合作接受度：${profile.acceptance || "待补充"}`,
  ].join("\n");
}

function generateReport({ report, user, mbti, messages, campuses }) {
  ensureReportDir();
  const filePath = path.join(reportDir, `${report.id}.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "五好生涯志愿填报咨询报告" } });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  if (fs.existsSync(fontPath)) {
    doc.font(fontPath);
  }

  drawWatermark(doc);
  doc.fontSize(21).fillColor("#163d32").text("五好生涯｜志愿填报辅助咨询报告", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#66736e").text(`报告编号：${report.id}    生成时间：${new Date(report.createdAt).toLocaleString("zh-CN")}`, { align: "center" });

  addSection(doc, "一、考生基础信息", `姓名：${user.name}\n性别：${user.gender}\n手机号：${user.phone}\n${formatProfile(user.studentProfile)}`);
  addSection(doc, "二、人格倾向摘要", `类型：${mbti.type}\n说明：${mbti.summary}\n提示：该结果用于辅助理解学习和决策偏好，不作为专业选择的唯一依据。`);

  const userMessages = messages.filter((item) => item.role === "user").map((item) => item.content).join("\n\n");
  const assistantMessages = messages.filter((item) => item.role === "assistant").map((item) => item.content).join("\n\n");
  addSection(doc, "三、用户提供的分数与偏好", userMessages || "用户尚未提供完整分数信息。");
  addSection(doc, "四、初步志愿建议", assistantMessages || "尚未形成完整建议。");
  addSection(
    doc,
    "五、待补充信息与人工复核建议",
    "正式填报前，请继续核对：最新招生计划、近三年专业组录取位次、单科/体检限制、调剂规则、民办与中外合作预算边界。建议携带成绩单、位次、选科、目标城市、专业偏好和家庭预算，与五好生涯顾问进行人工复核。"
  );

  addSection(
    doc,
    "六、人工咨询方式",
    campuses.map((campus) => `${campus.name}\n电话：${campus.phone}\n微信：${campus.wechat}\n地址：${campus.address}`).join("\n\n")
  );

  addSection(
    doc,
    "七、服务声明",
    "本报告由五好生涯志愿填报辅助决策系统根据用户输入和人格倾向结果生成，仅用于前期咨询参考，不构成最终填报方案或录取承诺。正式填报前，建议结合招生章程、最新计划、位次数据和人工咨询进行复核。"
  );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { generateReport, reportDir };
