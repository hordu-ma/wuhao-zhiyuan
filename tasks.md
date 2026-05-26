# 五好智学志愿填报辅助决策系统主账本

## 1. 项目结论

- 项目名称：五好智学｜志愿填报辅助决策系统
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
- [x] PDF 咨询报告生成，包含五好智学水印
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

- [x] 替换 `mock-campus`：默认咨询点改为五好生涯线上咨询中心与济南咨询点，并支持 `CAMPUS_CONFIG_JSON` 覆盖。
- [x] 替换 `temp-logo`：保留文字品牌标识，去除 mock 标记，后续可用正式素材替换。
- [x] 梳理隐私提示与用户授权文案，说明手机号、测评、对话和报告用途。
- [x] 明确生产数据备份策略，覆盖 `data/store.json`、`reports/` 和后台备份接口。

### P1：咨询质量与转化增强

- [x] 优化 AI system prompt，固定输出结构：考生画像、信息缺口、院校/专业建议、风险点、资料清单、咨询引导。
- [x] 报告增加“待补充信息与人工复核建议”板块，避免报告看起来像最终录取承诺。
- [x] 增加用户基础信息字段：省份、选科、分数、位次、预算、目标城市、专业偏好。
- [x] 在对话开始前用表单收集关键字段，减少 AI 首轮追问成本。

### P2：稳定性、安全与可维护性

- [x] 给注册、资料保存、MBTI 提交、AI 对话、报告生成和后台统计增加路由级测试。
- [x] 增加基础请求限流，降低登录、注册、AI 和报告接口滥用风险。
- [x] 将本地 JSON 存储增加规范化与备份接口，为后续 PostgreSQL 或复用 `wuhao-tutor` 数据库做准备。
- [x] 增加健康检查接口 `GET /healthz`。

### P3：运营后台与数据沉淀

- [x] 增加简单管理入口 `/admin`，查看用户、测评、对话、报告和联系方式。
- [x] 支持导出潜在客户列表 CSV：`/api/admin/leads.csv`。
- [x] 增加来源渠道参数记录：`source`、`utm_source`、`campus`。
- [x] 统计注册数、完测数、报告生成数、咨询转化线索数。

## 6. Mock 与技术债标记

- `campus-config`：默认咨询点可用，真实电话、微信、地址可通过 `CAMPUS_CONFIG_JSON` 覆盖。
- `mock-ai`：无 API key 时使用本地规则回复，只适合开发与兜底。
- `json-store`：生产仍使用本地 JSON 文件，已增加备份接口，后续可迁移数据库。
- `brand-assets`：当前使用文字品牌标识，后续可替换正式图片 logo。
- `route-tests`：已覆盖主流程、认证失败、未登录保护、后台令牌失败、线索 CSV、备份接口和登录限流分支。

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
- 咨询点配置：`CAMPUS_CONFIG_JSON` 未配置，当前使用默认“五好生涯线上咨询中心”和“五好生涯济南咨询点”。
- 备份演练：已通过 `POST /api/admin/backup` 生成生产备份 `store-2026-05-26T06-07-55-555Z.json`。
