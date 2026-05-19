function buildSystemPrompt({ user, mbti, campuses }) {
  return [
    "你是五好智学志愿填报辅助决策系统的升学规划顾问。",
    "你需要先整理考生分数、位次、省份、选科、目标城市、专业兴趣、家庭预算等信息，再给出初步志愿建议。",
    "建议必须结合用户姓名、性别和 MBTI 倾向，但不能把 MBTI 视为唯一依据。",
    "输出应包含：信息整理、院校层次、专业方向、人格倾向匹配、志愿风险提醒、人工咨询引导。",
    "强调这是初步辅助建议，不构成最终录取保证。",
    "人工咨询可引用这些校区联系方式：" + campuses.map((campus) => `${campus.name} 电话${campus.phone} 微信${campus.wechat}`).join("；"),
    `当前用户：姓名${user.name}，性别${user.gender}，MBTI ${mbti.type}，说明：${mbti.summary}`,
  ].join("\n");
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

function mockReply({ message, user, mbti, campuses }) {
  const info = extractScoreText(message);
  const campusText = campuses.map((campus) => `${campus.name}：电话 ${campus.phone}，微信 ${campus.wechat}`).join("\n");

  return `根据你目前提供的信息，我先给出一版初步分析。

一、考生信息整理
姓名：${user.name}
性别：${user.gender}
人格倾向：${mbti.type}，${mbti.summary}
省份：${info.province}
分数：${info.score}
位次：${info.rank}

二、初步志愿方向
如果分数和位次信息完整，建议按“冲、稳、保”三档建立院校池：冲刺档关注略高于当前位次的院校和优势专业，稳妥档选择近三年录取位次匹配度高的院校，保底档需要确保专业录取和调剂风险可控。专业选择上，应同时看学科优势、就业路径、城市资源和家庭预算。

三、结合 MBTI 的专业建议
${mbti.type} 倾向显示，你在学习和职业选择中可能更适合与自身决策方式、沟通方式和压力处理方式匹配的专业。建议不要只按热门程度选择专业，而要把课程难度、未来工作环境、个人兴趣稳定性一起纳入判断。

四、必须重视的风险
高考志愿不是简单按分数排序。常见风险包括：院校投档线波动、专业组内冷热差异、身体条件或单科限制、城市与就业资源错配、盲目追热门导致专业学习压力过大、保底志愿不足导致滑档。一次错误选择可能影响大学四年的学习体验、升学路径和就业入口。

五、下一步建议
建议进一步补充：所在省份、选科组合、总分、各科分数、精确位次、目标城市、不能接受的专业、是否接受民办和中外合作。五好智学可以基于完整信息做一对一人工复核，帮助你形成更稳妥的志愿梯度。

六、人工咨询
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
