const { examYear, formatAdmissionContext } = require("./admissions");

function buildSystemPrompt({ user, mbti, campuses, admissionContext }) {
  const profile = user.studentProfile || {};
  const referenceYear = admissionContext?.dataYear || admissionContext?.dataExamYear;
  return [
    "你是五好生涯志愿填报辅助决策系统的升学规划顾问。",
    `当前服务面向 ${examYear} 年高考，所有结论必须围绕 ${examYear} 年填报场景表达。`,
    referenceYear && referenceYear < examYear
      ? `当前使用 ${referenceYear} 年历史录取数据辅助模拟 ${examYear} 年填报。输出只需在开头用一句话提示“本分析参考 ${referenceYear} 年历史录取数据，待 ${examYear} 年官方数据发布后复核”，其余内容按真实咨询建议表达。`
      : "",
    "你需要先整理考生分数、位次、省份、选科、目标城市、专业兴趣、家庭预算等信息，再给出初步志愿建议。",
    "建议必须结合用户姓名、性别和 MBTI 倾向，但不能把 MBTI 视为唯一依据。",
    "请固定按以下结构输出：一、考生画像；二、关键信息缺口；三、院校与专业方向；四、志愿风险点；五、下一步资料清单；六、五好生涯人工咨询引导。",
    "如果信息不完整，要明确列出待补充项，不要虚构院校录取结论。",
    "除非下方招生数据包明确提供了学校、专业、年份、最低分、最低位次、招生计划和来源，否则禁止输出具体院校最低分、最低位次、学费、招生计划数、专业组代码等精确数据。",
    `如果招生数据包为空或没有匹配候选记录，只能给方向性建议、风险提示和待补充数据清单；如果使用历史数据，必须标明年份，不能冒充 ${examYear} 年录取结果。`,
    "面向用户的输出禁止使用“示例”“虚拟”“演示”“某院校”“A类院校”等占位措辞；如果招生数据包包含真实学校名称，就按真实学校名称输出。",
    "除数据包字段和用户画像之外，不要补写官网地址、合作企业、推免率、考研去向、实验室、活动安排、系统版本号等未提供事实。",
    "强调这是初步辅助建议，不构成最终录取保证。",
    "人工咨询可引用这些校区联系方式：" + campuses.map((campus) => `${campus.name} 电话${campus.phone} 微信${campus.wechat}`).join("；"),
    `当前用户：姓名${user.name}，性别${user.gender}，MBTI ${mbti.type}，说明：${mbti.summary}`,
    `已收集画像：省份${profile.province || "待补充"}，选科${profile.subjects || "待补充"}，总分${profile.score || "待补充"}，位次${profile.rank || "待补充"}，目标城市${profile.targetCities || "待补充"}，专业兴趣${profile.majorInterests || "待补充"}，家庭预算${profile.budget || "待补充"}，民办/中外合作接受度${profile.acceptance || "待补充"}`,
    "招生数据包：" + formatAdmissionContext(admissionContext || {}),
  ].filter(Boolean).join("\n");
}

function extractScoreText(text) {
  const score = text.match(/(\d{3})\s*分?/);
  const rank = text.match(/位次[：:\s]*(\d{2,8})|排名[：:\s]*(\d{2,8})/);
  const province = text.match(/(山东|北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆)/);
  return {
    score: score ? score[1] : "待补充",
    rank: rank ? rank[1] || rank[2] : "待补充",
    province: province ? province[1] : "待补充",
  };
}

function formatCandidates(admissionContext) {
  const candidates = admissionContext?.candidates || {};
  const lines = Object.entries({ rush: "冲刺参考", stable: "稳妥参考", safety: "保底参考" })
    .flatMap(([bucket, label]) =>
      (candidates[bucket] || []).map((record) => `${label}：${record.schoolName} ${record.majorName}（${record.admissionYear || "年份待补充"} 年历史数据，最低位次 ${record.minRank || "待补充"}，来源：${record.sourceName || "待补充"}）`)
    );
  return lines.length ? lines.join("\n") : "当前未接入可验证的院校录取数据，不能给出具体院校最低分或最低位次，只能先做方向性判断。";
}

function mockReply({ message, user, mbti, campuses, admissionContext }) {
  const info = extractScoreText(message);
  const profile = user.studentProfile || {};
  const campusText = campuses.map((campus) => `${campus.name}：电话 ${campus.phone}，微信 ${campus.wechat}`).join("\n");
  const warningText = (admissionContext?.warnings || []).join("；") || `当前建议面向 ${examYear} 年高考，具体录取数据以官方最新发布为准。`;

  return `根据你目前提供的信息，我先给出一版初步分析。

一、考生信息整理
姓名：${user.name}
性别：${user.gender}
人格倾向：${mbti.type}，${mbti.summary}
省份：${profile.province || info.province}
选科：${profile.subjects || "待补充"}
分数：${profile.score || info.score}
位次：${profile.rank || info.rank}
目标城市：${profile.targetCities || "待补充"}
专业兴趣：${profile.majorInterests || "待补充"}
家庭预算：${profile.budget || "待补充"}

二、关键信息缺口
${warningText}
正式形成梯度方案前，至少还需要确认：${examYear} 年一分一段表、${examYear} 年招生计划、近三年同位次录取数据、专业组限制、单科或体检要求、是否接受调剂、民办和中外合作边界。

三、院校与专业方向
${formatCandidates(admissionContext)}
如果分数和位次信息完整，建议按“冲、稳、保”三档建立院校池：冲刺档关注略高于当前位次的院校和优势专业，稳妥档选择近三年录取位次匹配度高的院校，保底档需要确保专业录取和调剂风险可控。专业选择上，应同时看学科优势、就业路径、城市资源和家庭预算。

四、结合 MBTI 的匹配提示
${mbti.type} 倾向显示，你在学习和职业选择中可能更适合与自身决策方式、沟通方式和压力处理方式匹配的专业。建议不要只按热门程度选择专业，而要把课程难度、未来工作环境、个人兴趣稳定性一起纳入判断。

五、志愿风险点
高考志愿不是简单按分数排序。常见风险包括：院校投档线波动、专业组内冷热差异、身体条件或单科限制、城市与就业资源错配、盲目追热门导致专业学习压力过大、保底志愿不足导致滑档。一次错误选择可能影响大学四年的学习体验、升学路径和就业入口。

六、下一步资料清单
建议进一步补充：所在省份、选科组合、总分、各科分数、精确位次、目标城市、不能接受的专业、是否接受民办和中外合作。五好生涯可以基于完整信息做一对一人工复核，帮助你形成更稳妥的志愿梯度。

七、人工咨询引导
${campusText}

如果你确认以上信息基本完整，可以点击页面中的“生成咨询报告”下载当前分析 PDF。`;
}

async function callDashScope({ systemPrompt, messages }) {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DASHSCOPE_MODEL || "qwen-plus";
  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((item) => ({ role: item.role, content: item.content })),
      ],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DashScope request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

module.exports = { buildSystemPrompt, callDashScope, mockReply };
