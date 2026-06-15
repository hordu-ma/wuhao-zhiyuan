# 五好生涯｜志愿填报辅助决策系统

面向高考志愿填报场景的一期闭环系统，包含品牌首页、手机号注册登录、48 题 16 型人格倾向测评、AI志愿对话、带五好生涯水印的 PDF 咨询报告。
当前版本补齐了考生关键信息采集、隐私确认、运营后台、线索导出、数据备份、健康检查和基础接口测试。

## 快速启动

```bash
npm install
PORT=18082 npm start
```

常用维护命令：

```bash
npm test
npm run restore:store -- data/backups/store-xxx.json
```

访问：

```text
http://127.0.0.1:18082
```

## 环境变量

- `PORT`：服务端口，默认 `18082`
- `SESSION_SECRET`：登录 cookie 签名密钥
- `DASHSCOPE_API_KEY` 或 `ALIYUN_API_KEY`：阿里云 DashScope API key
- `DASHSCOPE_MODEL`：模型名，默认 `qwen3.7-plus`
- `ADMIN_TOKEN`：运营后台访问令牌，访问 `/admin` 时使用
- `CAMPUS_CONFIG_JSON`：可选，JSON 数组形式的校区配置，会覆盖默认咨询点
- `EXAM_YEAR`：当前服务面向的高考年份，默认 `2026`
- `ADMISSIONS_DATA_PATH`：可选，招生数据 JSON 路径，默认读取 `data/admissions.json`
- `NODE_ENV`：生产应设为 `production`；此时若未配置 `SESSION_SECRET`，服务会拒绝启动
- `DATA_RETENTION_DAYS`：可选，个人数据保留天数，配合 `POST /api/admin/retention/purge` 清理过期数据

未配置阿里云密钥时，系统会使用本地 mock 志愿建议，详见 `tasks.md`。

## 关键页面与接口

- `/assessment/mbti`：48 题人格倾向测评
- `/chat`：考生信息采集、AI 志愿对话、报告生成
- `/profile`：个人中心与历史报告
- `/admin`：运营后台，依赖 `ADMIN_TOKEN`
- `/healthz`：健康检查
- `/api/admin/leads.csv`：线索 CSV 导出
- `/api/admin/summary?source=&campus=&status=`：运营后台筛选，支持来源、推荐校区和线索状态过滤
- `/api/admin/leads.csv?source=&campus=&status=`：带筛选条件的线索 CSV 导出，包含推荐校区、信息完整度、最近对话、报告状态和 AI 建议摘要
- `/api/admin/mbti.csv`：MBTI 测评结果 CSV 导出
- `/api/admin/chats.csv`：AI 对话与填报建议 CSV 导出
- `/api/admin/reports.csv`：报告生成记录 CSV 导出
- `/api/admin/export.json`：去除密码哈希和登录 session 后的完整运营分析 JSON 导出
- `DELETE /api/me`：用户删除本人账号及全部个人数据（需登录态）
- `DELETE /api/admin/users/:id`：运营按用户 ID 删除个人数据（需 `x-admin-token`）
- `POST /api/admin/retention/purge?days=N&confirm=true`：按保留天数清理过期数据，默认 dry-run（需 `x-admin-token`）

## 招生数据更新

- 大模型只解释系统提供的数据，不应自行编造院校最低分、最低位次、招生计划、学费或专业组代码。
- 默认招生数据文件为 `data/admissions.json`，该目录不提交 git；可参考 [docs/admissions-data.example.json](docs/admissions-data.example.json) 导入官方数据。
- 2026 年正式数据发布前，可导入 2025 年真实历史录取数据作为 `historical_reference` 模式，系统会按真实院校和专业给出完整建议，并在开头提示“参考 2025 年历史数据，待 2026 年官方数据发布后复核”。
- 若未配置招生数据或没有匹配候选记录，后端不会调用大模型生成具体院校建议，只返回规则模板、风险提示和待补充数据清单。

## 运营筛选状态

- `profileIncomplete`：考生关键信息少于 5 项，适合优先补资料。
- `profileComplete`：考生关键信息至少 5 项，适合进入人工复核。
- `mbtiDone`：已完成 MBTI 测评。
- `reportDone`：已生成报告。
- `noReport`：尚未生成报告。

## 质量与安全说明

- 报告生成前会检查省份、选科、分数、位次、目标城市、专业兴趣；信息不完整时需要用户确认后才生成初版报告。
- AI 对话回复会沉淀结构化摘要，便于运营后台快速判断建议方向、风险点和下一步资料。
- 本地 JSON 存储使用临时文件 + rename 原子写入，降低并发或异常退出导致 `store.json` 损坏的风险。
- 本地 JSON 存储要求单进程运行：服务启动时获取 `data/.store.lock` 独占锁，发现已有存活实例会拒绝启动；`updateStore` 也会拒绝异步 mutator，避免悄悄丢更新。水平扩展需迁移到带事务的数据库（见 `tasks.md` 的 `json-store` 技术债）。
- 报告 PDF 通过鉴权路由 `GET /reports/:file` 下载，仅报告归属用户（登录态）或携带 `ADMIN_TOKEN` 请求头可访问。
- 用户可通过个人中心「删除我的数据」或 `DELETE /api/me` 行使个人信息删除权，连同测评、对话记录与报告 PDF 一并清除；运营可用 `DELETE /api/admin/users/:id` 与 `POST /api/admin/retention/purge` 处理删除请求与数据保留。
- `npm run restore:store -- <backup-json-path>` 可从备份恢复 `data/store.json`，恢复前会自动创建 `pre-restore-*` 安全备份。
