# 五好生涯志愿填报辅助决策系统主账本

## 1. 项目结论

- 项目名称：五好生涯｜志愿填报辅助决策系统
- 生产地址：`https://zhiyuan.horsduroot.com`
- 当前阶段：一期 MVP 已上线，下一步进入“可信数据、运营转化、稳定性增强”阶段。
- 当前架构：单体 Node/Express 应用承载静态页面、API、AI 对话、PDF 报告生成和本地 JSON 存储。
- 核心闭环：注册登录 → MBTI 测评 → AI 志愿咨询 → PDF 报告下载 → 校区电话/微信引流。

## 2. 已完成基线

- [x] Express 应用骨架与静态前端
- [x] 手机号 + 密码注册登录
- [x] 个人中心基础页
- [x] 自研 16 型人格倾向测评与结果保存
- [x] AI 志愿对话，支持阿里云 DashScope
- [x] 未配置 API key 时启用本地 mock 建议
- [x] PDF 咨询报告生成，包含五好生涯水印
- [x] 校区电话和微信信息展示
- [x] 本地测试：`npm test`
- [x] 生产部署：systemd + Nginx + HTTPS + `zhiyuan.horsduroot.com`

## 3. 当前模块地图

- `src/server.js`：Express 路由、认证中间件、业务流程入口。
- `src/auth.js`：密码哈希、登录 session、当前用户识别。
- `src/mbti.js`：测评题目、计分逻辑、结果摘要。
- `src/ai.js`：DashScope 调用、本地 mock 回复。
- `src/report.js`：PDF 报告生成与下载目录。
- `src/store.js`：本地 JSON 存储读写。
- `public/`：首页、测评、对话、个人中心等浏览器端资源。
- `docs/deployment.md`：生产部署与维护命令。
- `AGENTS.md`：贡献者与 AI 协作指南。

## 4. 运行与验证命令

```bash
npm install
npm test
PORT=18082 npm start
npm run dev
```

- 本地访问：`http://127.0.0.1:18082`
- 生产服务：`wuhao-zhiyuan.service`
- 生产日志：`journalctl -u wuhao-zhiyuan -n 100 --no-pager`

## 5. 下一阶段优先级

### P0：真实运营数据替换 mock

- [x] 替换 `mock-campus`：默认咨询点改为五好生涯青州咨询中心与五好生涯济南咨询中心，并支持 `CAMPUS_CONFIG_JSON` 覆盖。
- [x] 替换 `temp-logo`：保留文字品牌标识，去除 mock 标记，后续可用正式素材替换。
- [x] 梳理隐私提示与用户授权文案，说明手机号、测评、对话和报告用途。
- [x] 明确生产数据备份策略，覆盖 `data/store.json`、`reports/` 和后台备份接口。
- [x] 运营后台增加来源、推荐校区和线索状态筛选，支持快速定位待跟进用户。
- [x] 线索导出增加推荐校区、信息完整度、最近对话时间、报告生成状态等运营跟进字段。
- [x] 生产环境显式配置真实校区 `CAMPUS_CONFIG_JSON`，避免依赖代码默认值。

### P1：咨询质量与转化增强

- [x] 优化 AI system prompt，固定输出结构：考生画像、信息缺口、院校/专业建议、风险点、资料清单、咨询引导。
- [x] 报告增加“待补充信息与人工复核建议”板块，避免报告看起来像最终录取承诺。
- [x] 增加用户基础信息字段：省份、选科、分数、位次、预算、目标城市、专业偏好。
- [x] 在对话开始前用表单收集关键字段，减少 AI 首轮追问成本。
- [x] 报告生成前检查省份、选科、分数、位次、目标城市、专业兴趣；缺项时要求用户确认后才生成初版报告。
- [x] AI 回复沉淀结构化摘要，后台可快速查看建议方向、风险点和下一步资料。

### P2：稳定性、安全与可维护性

- [x] 给注册、资料保存、MBTI 提交、AI 对话、报告生成和后台统计增加路由级测试。
- [x] 增加基础请求限流，降低登录、注册、AI 和报告接口滥用风险。
- [x] 将本地 JSON 存储增加规范化与备份接口，为后续 PostgreSQL 或复用 `wuhao-tutor` 数据库做准备。
- [x] 增加健康检查接口 `GET /healthz`。
- [x] 将 `data/store.json` 写入改为临时文件 + rename 原子写入。
- [x] 增加 `npm run restore:store -- <backup-json-path>` 恢复脚本，恢复前自动生成安全备份。

### P3：运营后台与数据沉淀

- [x] 增加简单管理入口 `/admin`，查看用户、测评、对话、报告和联系方式。
- [x] 支持导出潜在客户列表 CSV：`/api/admin/leads.csv`。
- [x] 支持导出 MBTI、AI 对话、报告记录 CSV 与完整运营分析 JSON。
- [x] 增加来源渠道参数记录：`source`、`utm_source`、`campus`。
- [x] 统计注册数、完测数、报告生成数、咨询转化线索数。
- [x] 运营后台增加 AI 建议摘要列，移动端表单和后台筛选控件适配优化。
- [x] 个人中心增加信息完整度、继续对话和生成报告入口。

## 6. Mock 与技术债标记

- `campus-config`：默认咨询点可用，真实电话、微信、地址可通过 `CAMPUS_CONFIG_JSON` 覆盖。
- `mock-ai`：无 API key 时使用本地规则回复，只适合开发与兜底。
- `json-store`：生产仍使用本地 JSON 文件，已增加原子写、备份、恢复脚本与运营分析导出接口；暂不迁移 PostgreSQL，后续用户量增长后再迁移数据库。
- `brand-assets`：当前使用文字品牌标识，后续可替换正式图片 logo。
- `route-tests`：已覆盖主流程、认证失败、未登录保护、后台令牌失败、线索/MBTI/对话/报告/JSON 导出、备份接口和登录限流分支。

## 7. 环境变量

- `PORT`：服务端口，默认 `18082`。
- `SESSION_SECRET`：登录 cookie 签名密钥，生产必须配置。
- `DASHSCOPE_API_KEY` 或 `ALIYUN_API_KEY`：阿里云 DashScope API key。
- `DASHSCOPE_MODEL`：模型名，默认 `qwen-plus`。
- `ADMIN_TOKEN`：运营后台访问令牌。
- `CAMPUS_CONFIG_JSON`：可选，校区配置 JSON 数组。

## 8. 生产部署事实

- 生产目标机：阿里云 ECS `121.199.173.244`
- 生产目录：`/opt/wuhao-zhiyuan`
- 生产环境文件：`/etc/wuhao-zhiyuan.env`
- Node 运行时：`/opt/node-v20`
- systemd 服务：`wuhao-zhiyuan.service`，已设置 `active` / `enabled`
- Nginx：HTTPS 反代到 `127.0.0.1:18082`
- 证书：Let's Encrypt，当前记录有效期至 `2026-08-17`

## 9. 回滚方式

- 应用层：停止或回退 `wuhao-zhiyuan.service` 对应代码目录。
- 反代层：禁用 `zhiyuan.horsduroot.com` 对应 Nginx server block 后 reload。
- 数据层：备份后恢复 `data/store.json` 与报告目录。
- 文档层：使用 git 恢复 `tasks.md`。

## 10. 2026-05-26 生产运营验收

- 本地测试：`npm test`，5 项通过。
- 公网健康检查：`https://zhiyuan.horsduroot.com/healthz` 返回 `ok: true`。
- 生产服务状态：`wuhao-zhiyuan.service` 为 `active` / `enabled`。
- 生产环境配置：`SESSION_SECRET`、`DASHSCOPE_API_KEY`、`DASHSCOPE_MODEL`、`ADMIN_TOKEN` 已配置。
- 咨询点配置：`CAMPUS_CONFIG_JSON` 未配置，当前使用默认“五好生涯青州咨询中心”和“五好生涯济南咨询中心”。
- 备份演练：已通过 `POST /api/admin/backup` 生成生产备份 `store-2026-05-26T06-07-55-555Z.json`。

## 11. 2026-05-30 P0 运营数据闭环

- 本地测试：`npm test`，5 项通过。
- 后台 `/admin` 增加来源、状态、校区筛选，筛选条件同步用于线索 CSV 导出。
- `/api/admin/summary` 返回 `filters.matched`，并在线索列表中展示推荐校区、信息完整度、最近对话时间。
- `/api/admin/leads.csv` 增加 `recommendedCampus`、`lastChatAt`、`latestReportAt`、`profileCompleteness` 字段。
- 推荐校区规则：优先匹配来源参数中的校区标识；其次按目标城市中的“济南”“青州/潍坊”匹配；否则使用第一个校区兜底。
- 生产已部署并确认 `/etc/wuhao-zhiyuan.env` 中 `CAMPUS_CONFIG_JSON` 显式配置真实校区，`wuhao-zhiyuan.service` 已重启且为 `active` / `enabled`。
- 生产验证：`https://zhiyuan.horsduroot.com/healthz` 正常返回 `ok: true`，`/api/campuses` 返回青州与济南两个真实校区，后台筛选接口 `status=noReport` 已通过鉴权验证。

## 12. 2026-05-30 P1-P3 收尾

- 本地测试：`npm test`，7 项通过。
- P1：报告前补齐核心信息检查，允许用户明确确认后生成初版报告；AI 回复保存结构化摘要。
- P2：本地 JSON 存储改为原子写入，新增 `scripts/restore-store.js` 与 `npm run restore:store -- <backup-json-path>`。
- P3：后台线索表展示建议摘要；个人中心展示资料完整度，并提供继续对话/生成报告入口；移动端布局做了基本适配。
- 生产已部署：生产代码备份为 `/opt/wuhao-zhiyuan-deploy-backups/code-20260530155046.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，7 项通过。
- 生产服务：`wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 生产验证：`/healthz` 返回 `ok: true`，公网首页返回 `HTTP/2 200`，`/api/campuses` 返回青州与济南两个真实校区，线索 CSV 表头包含 `adviceSummary`。

## 13. 2026-06-01 MBTI 测评体系升级

- 本地测试：`npm test`，9 项通过。
- 测评题库从 32 道扩展为 48 道，每个 MBTI 极性各 6 道，覆盖高考志愿、学习方式、信息判断、压力处理和决策风格场景。
- `scoreMbti` 保持原有 `type`、`scores`、`summary` 兼容，并新增 `preferences`，用于记录四个维度的倾向、强度和解释。
- `/api/mbti/submit` 增加 1-5 分值校验，避免非法答案进入测评记录。
- 前端测评页补充 1-5 分含义，首页题量文案已同步为 48 道。
- 生产已部署：生产代码备份为 `/opt/wuhao-zhiyuan-deploy-backups/code-20260601073641.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，9 项通过。
- 生产服务：`wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 生产验证：`/healthz` 返回 `ok: true`，公网首页返回 `HTTP/2 200`，公网 `/api/mbti/questions` 返回 48 道题。
- 回滚方式：恢复 `src/mbti.js`、`src/server.js`、`public/app.js`、`public/styles.css` 和对应测试文件；生产回滚时保留 `data/`、`reports/`、`node_modules/`。

## 14. 2026-06-01 招生数据与大模型边界

- 当前服务年份显式设为 `EXAM_YEAR=2026` 默认值，prompt 会要求所有结论围绕 2026 年高考表达。
- 新增 `src/admissions.js` 招生数据层，默认读取 `data/admissions.json` 或 `ADMISSIONS_DATA_PATH`，支持按省份、选科、位次、目标城市和专业兴趣检索候选记录。
- 新增 `docs/admissions-data.example.json` 作为导入格式参考；真实数据应来自省教育考试院、阳光高考或学校招生网等可追溯来源。
- `/api/chat/message` 现在会先生成招生数据包，再交给大模型；模型只能解释数据包，不能自行编造院校最低分、最低位次、招生计划、学费或专业组代码。
- 2026 年正式数据发布前，可使用 2025 年真实历史录取数据作为 `historical_reference` 模式，让系统体验与正式数据到位后基本一致，只在开头提示参考数据年份。
- 未配置招生数据或没有匹配候选记录时，后端会跳过大模型院校建议，直接返回规则模板、风险提示和待补充数据清单。
- 本地测试：`npm test`，11 项通过。

## 15. 2026-06-13 代码审阅修复（正确性 / 安全 / 稳定性）

本轮基于完整代码审阅，修复一批正确性、安全与稳定性问题。修复原则：最小改动、不引入新依赖、补齐回归测试。

### P0 正确性 / 数据安全

- [x] **AI 对话跨 `await` 丢数据竞态**（`src/server.js` `/api/chat/message`）：原实现 `readStore()` → `await callDashScope()` → `writeStore()`，在等待大模型的数秒窗口内会用旧快照覆盖其它请求的写入，导致用户、测评、报告记录丢失。改为：先用只读快照构造上下文并调用大模型，落库阶段只用一次同步 `updateStore()` 重新读取最新库再追加用户与助手消息，关闭丢失窗口。
- [x] **建议摘要解析与 mock 输出结构错位**（`src/ai.js` / `src/server.js`）：`createAdviceSummary` 按「一、考生画像 / 二、关键信息缺口 / 三、院校与专业方向 / 四、志愿风险点 / 五、下一步资料清单」解析，但 `mockReply` 此前用的是另一套七段标题，导致默认 mock 模式下 `risk`、`nextStep` 摘要恒为空。已将 `mockReply` 重写为与 system prompt 强制结构完全一致的六段，使风险点与资料清单摘要可被正确提取。
- [x] **MBTI 计分方向缺失**（`src/mbti.js`）：原逻辑把 1-5 分直接累加到题目所属极，「非常不同意」一道 E 题仍给 E 加分，量表无法体现倾向方向。改为有符号计分：以 3 分为中点，赞同累加到本极、反对累加到对立极，中点不计分；保持 `type`、`scores`、`preferences`、`summary` 输出结构兼容。

### P1 安全 / 隐私

- [x] **报告 PDF 无鉴权直出**（`src/server.js`）：原 `express.static("/reports")` 把含姓名、手机号、画像的 PDF 整目录公开，仅靠随机 ID 防护。改为鉴权下载路由 `GET /reports/:file`，仅报告归属用户（会话 cookie）或携带 `ADMIN_TOKEN`（请求头或 `?token=`）可下载，其余返回 403。
- [x] **CSV 公式注入**（`src/server.js` `csvEscape`）：运营导出的姓名、来源等用户可控字段若以 `= + - @` 开头，在 Excel 打开时可能被当作公式执行。已对这类字段加 `'` 前缀转义。

### P2 稳定性 / 资源

- [x] **限流桶内存泄漏**（`src/server.js`）：`rateBuckets` 按 IP 永久累积。新增定期清理过期桶的定时器（仅在服务进程运行时启动，`unref` 不阻塞退出）。
- [x] **登录会话只增不减**（`src/auth.js` / `src/server.js`）：`getCurrentUser` 增加基于 `createdAt` 的 14 天过期判定，并由清理定时器周期性裁剪过期 `sessions`，避免无限增长与全表扫描变慢。
- [x] **报告记录先于 PDF 落库**（`src/server.js`）：原先先写库再生成 PDF，生成失败会留下「有记录无文件」脏数据。改为先生成 PDF，成功后再 `updateStore` 落库，并对生成失败返回 500。

### P3 检索质量（小修）

- [x] **选科匹配假阳性**（`src/admissions.js`）：原用短别名 `includes` 时「生物」会命中「物」，使只选生物的考生被判满足「物理」要求。改为先按完整科目名解析考生选科集合，再逐项校验招生要求，消除子串误命中。

### 回归测试

- [x] `src/server.test.js`：新增报告下载鉴权用例（未登录 403、归属用户 200），并断言 mock 摘要的 `risk`、`nextStep` 非空。
- [x] `src/mbti.test.js`：新增计分方向用例，验证赞同与反对会推向相反极。

### 验证

- [x] 本地 `npm test` 全部通过。
- [x] 生产部署后 `npm test` 通过、`/healthz` 正常、首页 200、`/api/campuses` 与 `/api/mbti/questions` 正常。
- [x] 生产报告下载鉴权与 mock 摘要表现符合预期。
- 生产已部署：生产代码备份为 `/opt/wuhao-zhiyuan-deploy-backups/code-20260601095549.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，11 项通过。
- 生产验证：`/healthz` 返回 `ok: true`；当前未配置 `data/admissions.json` 时，规则模板明确提示不能给出具体院校最低分或最低位次。
