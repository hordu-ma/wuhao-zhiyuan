# 五好智学志愿填报辅助决策系统主账本

## 项目结论

- 项目名称：五好智学｜志愿填报辅助决策系统
- 首页目标域名：https://zhiyuan.horsduroot.com
- 一期目标：打通注册登录、MBTI测评、AI志愿对话、PDF报告下载、校区电话/微信引流闭环。
- 当前实现策略：使用单体 Node/Express 服务承载前端页面、后端 API、报告生成和静态资源，便于快速部署到子域名。

## 一期功能清单

- [x] 建立项目主账本 `tasks.md`
- [x] 搭建 Express 应用骨架
- [x] 首页：导航栏、品牌介绍、使用流程、登录注册入口、校区联系方式
- [x] 手机号 + 密码注册登录
- [x] 个人中心基础页
- [x] 自研 16 型人格倾向问卷，避免直接复制官方 MBTI 题库
- [x] MBTI 结果计算和保存
- [x] 对话窗口自动注入姓名、性别、MBTI
- [x] 大模型接口封装，支持阿里云 DashScope 环境变量
- [x] 无 API key 时启用 mock 志愿建议
- [x] PDF 报告生成，包含五好智学水印
- [x] 校区电话和微信信息展示
- [x] 本地服务启动验证
- [x] 本地后台进程运行在 `127.0.0.1:18082`
- [ ] zhiyuan.horsduroot.com 域名反向代理验证
- [x] git add / commit / push

## 页面结构

- `/`：首页，含项目理念、使用方式、注册登录、校区联系方式。
- `/assessment/mbti`：MBTI倾向测评页。
- `/chat`：AI志愿对话页。
- `/profile`：个人中心。
- `/reports/:id.pdf`：PDF咨询报告下载。

## API 结构

- `POST /api/auth/register`：手机号、密码、姓名、性别注册。
- `POST /api/auth/login`：手机号、密码登录。
- `POST /api/auth/logout`：退出登录。
- `GET /api/me`：当前登录用户。
- `POST /api/mbti/submit`：提交测评答案。
- `GET /api/mbti/latest`：读取最近一次测评结果。
- `POST /api/chat/message`：发送对话消息并获取 AI 回复。
- `POST /api/report/generate`：生成 PDF 报告。
- `GET /api/campuses`：校区联系方式。

## 数据与资源

- 品牌资料来源：`/home/pgx/asset-base/internal/五好爱学`
- 当前未发现可直接用于网页导航的透明 logo，已使用自绘 SVG 临时 logo。
- 校区联系方式：当前使用 mock 校区数据。
- 数据存储：当前使用 `data/store.json` 本地 JSON 文件。
- 数据库资源：尚未接入 `wuhao-tutor` 的数据库配置，因本机未找到 `wuhao-tutor` 仓库或可复用环境文件。
- 大模型：支持阿里云 DashScope；若未设置 API key，自动使用 mock 回复。

## 环境变量

- `PORT`：服务端口，默认 `18082`。
- `SESSION_SECRET`：登录 cookie 签名密钥。
- `DASHSCOPE_API_KEY` 或 `ALIYUN_API_KEY`：阿里云大模型密钥。
- `DASHSCOPE_MODEL`：模型名，默认 `qwen-plus`。

## Mock 标记

- `mock-campus`：校区电话和微信为占位数据，需用真实校区信息替换。
- `mock-ai`：未检测到阿里云 API key 时，对话建议由本地规则生成。
- `json-store`：当前为本地 JSON 存储，生产环境建议迁移到 PostgreSQL 或复用 `wuhao-tutor` 数据库资源。
- `temp-logo`：当前 logo 为临时 SVG，可在找到正式品牌 logo 后替换。

## 部署计划

1. 安装依赖：`npm install`
2. 启动服务：`PORT=18082 npm start`
3. 配置进程守护：优先使用 `pm2`，没有则使用 `nohup` 临时运行。
4. 配置 Nginx/Caddy/系统反代，将 `zhiyuan.horsduroot.com` 指向 `127.0.0.1:18082`。
5. 验证：
   - 首页可访问
   - 注册登录可用
   - MBTI提交后跳转对话
   - 对话可生成建议
   - PDF可下载且带水印

## 当前部署状态

- 已安装 Node 依赖。
- 已通过 `setsid env PORT=18082 node src/server.js ...` 启动后台服务。
- `http://127.0.0.1:18082/` 返回 200。
- `zhiyuan.horsduroot.com` 暂未解析，`dig +short zhiyuan.horsduroot.com` 无结果。
- 当前用户无免密 sudo，无法安装 Nginx/Caddy 或写入系统反代配置。
- 反代配置示例见 `docs/deployment.md`。

## 回滚方式

- 应用层：停止 Node 进程即可回滚服务。
- 反代层：移除或禁用 `zhiyuan.horsduroot.com` 对应 server block。
- 数据层：当前本地数据位于 `data/store.json`，可备份后清空。
