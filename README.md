# 五好生涯｜志愿填报辅助决策系统

面向高考志愿填报场景的一期闭环系统，包含品牌首页、手机号注册登录、16型人格倾向测评、AI志愿对话、带五好生涯水印的 PDF 咨询报告。
当前版本补齐了考生关键信息采集、隐私确认、运营后台、线索导出、数据备份、健康检查和基础接口测试。

## 快速启动

```bash
npm install
PORT=18082 npm start
```

访问：

```text
http://127.0.0.1:18082
```

## 环境变量

- `PORT`：服务端口，默认 `18082`
- `SESSION_SECRET`：登录 cookie 签名密钥
- `DASHSCOPE_API_KEY` 或 `ALIYUN_API_KEY`：阿里云 DashScope API key
- `DASHSCOPE_MODEL`：模型名，默认 `qwen-plus`
- `ADMIN_TOKEN`：运营后台访问令牌，访问 `/admin` 时使用
- `CAMPUS_CONFIG_JSON`：可选，JSON 数组形式的校区配置，会覆盖默认咨询点

未配置阿里云密钥时，系统会使用本地 mock 志愿建议，详见 `tasks.md`。

## 关键页面与接口

- `/assessment/mbti`：人格倾向测评
- `/chat`：考生信息采集、AI 志愿对话、报告生成
- `/profile`：个人中心与历史报告
- `/admin`：运营后台，依赖 `ADMIN_TOKEN`
- `/healthz`：健康检查
- `/api/admin/leads.csv`：线索 CSV 导出
- `/api/admin/summary?source=&campus=&status=`：运营后台筛选，支持来源、推荐校区和线索状态过滤
- `/api/admin/leads.csv?source=&campus=&status=`：带筛选条件的线索 CSV 导出，包含推荐校区、信息完整度、最近对话和报告状态
- `/api/admin/mbti.csv`：MBTI 测评结果 CSV 导出
- `/api/admin/chats.csv`：AI 对话与填报建议 CSV 导出
- `/api/admin/reports.csv`：报告生成记录 CSV 导出
- `/api/admin/export.json`：去除密码哈希和登录 session 后的完整运营分析 JSON 导出

## 运营筛选状态

- `profileIncomplete`：考生关键信息少于 5 项，适合优先补资料。
- `profileComplete`：考生关键信息至少 5 项，适合进入人工复核。
- `mbtiDone`：已完成 MBTI 测评。
- `reportDone`：已生成报告。
- `noReport`：尚未生成报告。
