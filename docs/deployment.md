# 部署说明

## 当前状态

- 应用服务端口：`18082`
- 本机验证地址：`http://127.0.0.1:18082`
- 生产目标机：阿里云 ECS `121.199.173.244`，即 `horsduroot.com` / `www.horsduroot.com` 当前所在机器。
- 生产访问地址：`https://zhiyuan.horsduroot.com`
- 生产应用目录：`/opt/wuhao-zhiyuan`
- 生产环境文件：`/etc/wuhao-zhiyuan.env`
- 生产 systemd 服务：`wuhao-zhiyuan.service`
- 招生数据文件：默认 `/opt/wuhao-zhiyuan/data/admissions.json`，可用 `ADMISSIONS_DATA_PATH` 覆盖。
- 健康检查：`https://zhiyuan.horsduroot.com/healthz`
- 运营后台：`https://zhiyuan.horsduroot.com/admin`，需要 `ADMIN_TOKEN`
- 运营筛选：后台支持来源、推荐校区、线索状态筛选；同样参数可用于 `/api/admin/leads.csv`
- 后台启动命令：

```bash
setsid env PORT=18082 node src/server.js > /home/pgx/code-repos/wuhao-zhiyuan/zhiyuan.log 2>&1 < /dev/null &
```

## 域名反代目标

在生产 ECS 上将 `zhiyuan.horsduroot.com` 反向代理到：

```text
http://127.0.0.1:18082
```

## Nginx 示例

生产 ECS 已有 Nginx。需要使用可登录 ECS 的私钥进入服务器后，将以下 server block 加入 `/etc/nginx/conf.d/` 或现有站点配置。

```nginx
server {
    listen 80;
    server_name zhiyuan.horsduroot.com;

    location / {
        proxy_pass http://127.0.0.1:18082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 可使用 certbot 或现有证书系统补齐。

## Apache 示例

当前机器存在 `/usr/sbin/apache2`，如服务器使用 Apache，可启用 `proxy` 和 `proxy_http` 后配置：

```apache
<VirtualHost *:80>
    ServerName zhiyuan.horsduroot.com
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:18082/
    ProxyPassReverse / http://127.0.0.1:18082/
</VirtualHost>
```

## 生产结果

- 已使用 `~/Downloads/wuhao-ecs.pem` 登录生产 ECS。
- 已安装独立 Node 20 到 `/opt/node-v20`。
- 已同步应用到 `/opt/wuhao-zhiyuan` 并安装生产依赖。
- 已从 `/opt/wuhao-tutor/.env.production` 提取百炼 API key，写入 `/etc/wuhao-zhiyuan.env`。
- 已创建 `wuhao-zhiyuan.service`，服务状态为 `active` / `enabled`。
- 已通过 AliDNS API 创建 `zhiyuan.horsduroot.com` A 记录，指向 `121.199.173.244`。
- 已申请 Let's Encrypt 证书，证书路径为 `/etc/letsencrypt/live/zhiyuan.horsduroot.com/fullchain.pem`。
- 已配置 Nginx，HTTP 跳转 HTTPS，HTTPS 反代 `127.0.0.1:18082`。
- 已完成公网 HTTPS 冒烟验证：注册、MBTI、DashScope 对话、PDF 下载均成功。

## 生产部署命令

可在本机添加 SSH 配置：

```sshconfig
Host wuhao-tutor-ecs
    HostName 121.199.173.244
    User root
    IdentityFile ~/.ssh/wuhao-ecs.pem
    IdentitiesOnly yes
```

常用维护命令：

```bash
ssh wuhao-tutor-ecs 'systemctl status wuhao-zhiyuan --no-pager'
ssh wuhao-tutor-ecs 'journalctl -u wuhao-zhiyuan -n 100 --no-pager'
ssh wuhao-tutor-ecs 'nginx -t && systemctl reload nginx'
ssh wuhao-tutor-ecs 'grep -q "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env || echo "ADMIN_TOKEN=$(openssl rand -hex 24)" >> /etc/wuhao-zhiyuan.env'
```

部署后验证命令：

```bash
ssh wuhao-tutor-ecs 'curl -sf http://127.0.0.1:18082/ >/dev/null && echo app_ok'
ssh wuhao-tutor-ecs 'curl -sf http://127.0.0.1:18082/healthz'
curl -I https://zhiyuan.horsduroot.com/
```

## 数据备份

- 主数据文件：生产目录下的 `data/store.json`
- 报告目录：生产目录下的 `reports/`
- 后台备份接口：`POST /api/admin/backup`，请求头 `x-admin-token: <ADMIN_TOKEN>`
- 备份输出目录：`data/backups/`
- 恢复命令：`PATH=/opt/node-v20/bin:$PATH npm run restore:store -- data/backups/store-xxx.json`，恢复前会自动生成 `pre-restore-*` 安全备份。

## 数据导出

以下接口均需要请求头 `x-admin-token: <ADMIN_TOKEN>`：

- `GET /api/admin/leads.csv`：线索、分数、位次、目标城市、专业偏好等汇总。
- `GET /api/admin/leads.csv?source=&campus=&status=`：带筛选条件的线索导出，额外包含推荐校区、信息完整度、最近对话时间、报告生成时间和 AI 建议摘要。
- `GET /api/admin/mbti.csv`：MBTI 类型、8 个维度分数、用户基础画像。
- `GET /api/admin/chats.csv`：AI 对话消息与填报建议全文，包含回复来源。
- `GET /api/admin/reports.csv`：PDF 报告生成记录与下载路径。
- `GET /api/admin/export.json`：完整运营分析 JSON，不包含密码哈希和登录 session。

## 个人信息删除与数据保留（PIPL）

- 用户自助删除：个人中心「删除我的数据」按钮，或 `DELETE /api/me`（登录态），会级联删除账号、测评、对话记录、报告记录与对应 PDF 文件。
- 运营删除：`DELETE /api/admin/users/:id`（请求头 `x-admin-token`），用于处理删除请求或清理误注册数据。
- 数据保留执行：`POST /api/admin/retention/purge`，默认 dry-run 返回将被清理的用户数；确认后真正删除。

```bash
# 预览将被清理的过期数据（不删除）
ssh wuhao-tutor-ecs 'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); \
  curl -fsS -X POST -H "x-admin-token: ${TOKEN}" "http://127.0.0.1:18082/api/admin/retention/purge?days=365"'
# 确认清理
ssh wuhao-tutor-ecs 'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); \
  curl -fsS -X POST -H "x-admin-token: ${TOKEN}" "http://127.0.0.1:18082/api/admin/retention/purge?days=365&confirm=true"'
```

## 单进程约束与启动保护

- 本地 JSON 存储要求单进程运行。服务启动会获取 `data/.store.lock` 独占锁；若已有存活实例，新进程会以非 0 退出码拒绝启动，避免并发写丢数据。
- 生产环境（`NODE_ENV=production`）未配置 `SESSION_SECRET` 时服务拒绝启动。`/etc/wuhao-zhiyuan.env` 必须同时包含 `NODE_ENV=production` 与 `SESSION_SECRET`。
- 切勿对该服务使用 pm2 cluster 或多副本部署；水平扩展前需先迁移到带事务的数据库。

## 招生数据维护

- 当前服务默认面向 `EXAM_YEAR=2026`，可在 `/etc/wuhao-zhiyuan.env` 中显式配置。
- 招生数据默认读取生产目录下的 `data/admissions.json`；该文件属于运行数据，不随 git 部署覆盖。
- 数据格式参考仓库内 `docs/admissions-data.example.json`。
- 推荐来源优先级：省教育考试院官方发布的一分一段表、招生计划、投档线；阳光高考；高校招生网章程和分专业计划。
- 更新招生数据后需要重启服务：`systemctl restart wuhao-zhiyuan`。
- 2026 年正式数据发布前，可导入 2025 年真实历史录取数据并设置 `dataMode=historical_reference`、`dataYear=2025`；系统会按真实院校和专业给出完整建议，并在开头提示“参考 2025 年历史数据，待 2026 年官方数据发布后复核”。
- 如果没有导入招生数据或没有匹配候选记录，后端会跳过大模型院校建议，返回规则模板和资料清单，不输出具体院校线或计划数。

线索状态筛选值：

- `profileIncomplete`：考生关键信息少于 5 项。
- `profileComplete`：考生关键信息至少 5 项。
- `mbtiDone`：已完成测评。
- `reportDone`：已生成报告。
- `noReport`：尚未生成报告。

示例：

```bash
ssh -i ~/Downloads/wuhao-ecs.pem root@121.199.173.244 \
  'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); \
  curl -fsS -H "x-admin-token: ${TOKEN}" http://127.0.0.1:18082/api/admin/export.json \
  > /tmp/wuhao-zhiyuan-export.json'
```

### 备份演练记录

- 2026-05-26：已在生产机通过后台备份接口生成 `data/backups/store-2026-05-26T06-07-55-555Z.json`。
- 演练命令会从 `/etc/wuhao-zhiyuan.env` 读取 `ADMIN_TOKEN`，不要在终端输出或提交令牌明文。

```bash
ssh -i ~/Downloads/wuhao-ecs.pem root@121.199.173.244 \
  'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); \
  curl -fsS -X POST -H "x-admin-token: ${TOKEN}" http://127.0.0.1:18082/api/admin/backup'
```

## 2026-05-26 验收记录

- 本地：`npm test`，5 项通过。
- 公网：`curl -fsS https://zhiyuan.horsduroot.com/healthz` 返回 `ok: true`。
- 生产机：`systemctl is-active wuhao-zhiyuan` 返回 `active`，`systemctl is-enabled wuhao-zhiyuan` 返回 `enabled`。
- 环境：`SESSION_SECRET`、`DASHSCOPE_API_KEY`、`DASHSCOPE_MODEL`、`ADMIN_TOKEN` 已配置；`CAMPUS_CONFIG_JSON` 未配置，使用默认咨询点。

## 2026-05-30 P0 运营闭环部署项

- 已同步代码到 `/opt/wuhao-zhiyuan`，保留生产 `data/`、`reports/` 和 `node_modules/`。
- 部署前已备份生产代码到 `/opt/wuhao-zhiyuan-deploy-backups/code-20260530154159.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，5 项通过。
- `/etc/wuhao-zhiyuan.env` 已显式配置 `CAMPUS_CONFIG_JSON`，当前真实校区为五好生涯青州咨询中心与五好生涯济南咨询中心。
- `wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 部署验证已通过：

```bash
ssh wuhao-tutor-ecs 'systemctl is-active wuhao-zhiyuan && systemctl is-enabled wuhao-zhiyuan'
curl -fsS https://zhiyuan.horsduroot.com/healthz
ssh wuhao-tutor-ecs 'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); curl -fsS -H "x-admin-token: ${TOKEN}" "http://127.0.0.1:18082/api/admin/summary?status=noReport" >/dev/null && echo admin_filter_ok'
```

## 2026-05-30 P1-P3 部署项

- 已同步代码到 `/opt/wuhao-zhiyuan`，保留生产 `data/`、`reports/` 和 `node_modules/`。
- 部署前已备份生产代码到 `/opt/wuhao-zhiyuan-deploy-backups/code-20260530155046.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，7 项通过。
- 报告生成接口会在核心信息缺失时返回 `PROFILE_INCOMPLETE`，前端会要求用户确认后再生成初版报告。
- `data/store.json` 使用原子写入；如需恢复备份，先在生产目录执行恢复命令，再重启 `wuhao-zhiyuan.service`。
- `wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 部署验证已通过：公网 `/healthz` 返回 `ok: true`，首页返回 `HTTP/2 200`，`/api/campuses` 返回真实校区，线索 CSV 表头包含 `adviceSummary`。
- 验证命令：

```bash
ssh wuhao-tutor-ecs 'cd /opt/wuhao-zhiyuan && PATH=/opt/node-v20/bin:$PATH npm test'
ssh wuhao-tutor-ecs 'systemctl restart wuhao-zhiyuan && systemctl is-active wuhao-zhiyuan && systemctl is-enabled wuhao-zhiyuan'
curl -fsS https://zhiyuan.horsduroot.com/healthz
ssh wuhao-tutor-ecs 'TOKEN=$(grep "^ADMIN_TOKEN=" /etc/wuhao-zhiyuan.env | cut -d= -f2-); curl -fsS -H "x-admin-token: ${TOKEN}" "http://127.0.0.1:18082/api/admin/leads.csv?status=noReport" | head -n 1'
curl -fsSI https://zhiyuan.horsduroot.com/ | head -n 1
```

## 2026-06-01 MBTI 测评体系部署项

- 本次变更：MBTI 测评题库从 32 道扩展为 48 道，新增四个维度的倾向强度解释，并对 `/api/mbti/submit` 增加 1-5 分值校验。
- 本地测试：`npm test`，9 项通过。
- 部署方式：同步代码到 `/opt/wuhao-zhiyuan`，保留生产 `data/`、`reports/` 和 `node_modules/`。
- 部署前已备份生产代码到 `/opt/wuhao-zhiyuan-deploy-backups/code-20260601073641.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，9 项通过。
- `wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 部署验证已通过：生产机本地 `/healthz` 返回 `ok: true`，生产机本地 `/api/mbti/questions` 返回 48 道题；公网 `/healthz` 返回 `ok: true`，首页返回 `HTTP/2 200`，公网 `/api/mbti/questions` 返回 48 道题。
- 回滚方式：使用部署前代码备份恢复 `/opt/wuhao-zhiyuan` 代码文件，保留 `data/`、`reports/` 和 `node_modules/`，然后重启 `wuhao-zhiyuan.service`。
- 验证命令：

```bash
ssh -i /home/pgx/Downloads/wuhao-ecs.pem -o IdentitiesOnly=yes root@121.199.173.244 'cd /opt/wuhao-zhiyuan && PATH=/opt/node-v20/bin:$PATH npm test'
ssh -i /home/pgx/Downloads/wuhao-ecs.pem -o IdentitiesOnly=yes root@121.199.173.244 'systemctl restart wuhao-zhiyuan && systemctl is-active wuhao-zhiyuan && systemctl is-enabled wuhao-zhiyuan'
curl -fsS https://zhiyuan.horsduroot.com/healthz
curl -fsS https://zhiyuan.horsduroot.com/api/mbti/questions | grep -o '"id":' | wc -l
curl -fsSI https://zhiyuan.horsduroot.com/ | head -n 1
```

## 2026-06-01 招生数据 Guardrail 部署项

- 本次变更：服务默认面向 `EXAM_YEAR=2026`；新增 `src/admissions.js` 招生数据层；无招生数据或无匹配候选记录时，后端跳过大模型院校建议，返回规则模板和资料清单。
- 部署前已备份生产代码到 `/opt/wuhao-zhiyuan-deploy-backups/code-20260601095549.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，11 项通过。
- `wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 部署验证已通过：公网 `/healthz` 返回 `ok: true`；生产机当前未配置 `data/admissions.json` 时，规则模板明确提示“不能给出具体院校最低分或最低位次”。
- 数据导入后验证重点：确认 `data/admissions.json` 字段来源可追溯，重启服务后使用测试画像确认 `hasAdmissionCandidates=true`，再检查模型只引用数据包内的学校、专业、年份、位次和来源。

## 2026-06-13 代码审阅修复部署项（第一批）

- 本次变更：修复 AI 对话跨 `await` 丢数据竞态、mock 摘要结构错位、MBTI 计分方向、报告 PDF 鉴权下载、CSV 公式注入、限流桶/会话清理、报告记录先于 PDF 落库、选科匹配假阳性。
- 部署提交：`e167a8c`。部署前代码备份：`/opt/wuhao-zhiyuan-deploy-backups/code-20260613105311.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，12 项通过。
- `wuhao-zhiyuan.service` 已重启，状态为 `active` / `enabled`。
- 公网验证：`/healthz` `ok:true`、首页 `200`、48 题；注册→测评→对话(mock-ai)→报告生成全流程 `200`；报告下载未登录 `403`、归属用户 `200 application/pdf`；后台建议摘要恢复为「方向｜风险｜资料清单」三段。

## 2026-06-13 最佳实践收尾部署项（第二批）

- 本次变更：个人数据删除接口（`DELETE /api/me`、`DELETE /api/admin/users/:id`、`POST /api/admin/retention/purge`）与个人中心删除按钮；JSON 存储单实例锁与异步 mutator 拒绝；后台令牌仅收请求头、移除 `?token=`；生产缺 `SESSION_SECRET` 拒绝启动；新增 GitHub Actions CI。
- 部署提交：`82fb485`。部署前代码备份：`/opt/wuhao-zhiyuan-deploy-backups/code-20260613112104.tar.gz`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，18 项通过。
- 启动保护：生产 `NODE_ENV=production` + `SESSION_SECRET` 已配置；`data/.store.lock` 正常生成；连续两次 `systemctl restart` 验证 SIGTERM 优雅释放并重新获取锁。
- 公网验证：`/healthz` `ok:true`、首页 `200`、校区 2、题目 48；`DELETE /api/me` 自助删除生效；`?token=` 后台访问被拒 `401`；管理员删除接口级联移除报告 PDF 已实测。
- 运维提示：该服务为单进程约束，**禁止** pm2 cluster 或多副本；新增删除/保留接口见本文件「个人信息删除与数据保留」一节。

## 2026-06-15 百炼模型切换部署项

- 本次变更：默认百炼模型从 `qwen-plus` 切换为 `qwen3.7-plus`。
- 部署提交：`2d9803a`。部署前代码备份：`/opt/wuhao-zhiyuan-deploy-backups/code-20260615143249.tar.gz`。
- 生产环境：`/etc/wuhao-zhiyuan.env` 显式配置 `DASHSCOPE_MODEL=qwen3.7-plus`。
- 生产环境文件备份：`/etc/wuhao-zhiyuan.env.20260615143322.bak`。
- 生产测试：`PATH=/opt/node-v20/bin:$PATH npm test`，18 项通过。
- 服务状态：`wuhao-zhiyuan.service` 重启后为 `active` / `enabled`。
- 验证结果：运行中进程环境变量为 `DASHSCOPE_MODEL=qwen3.7-plus`；使用生产 API key 调用百炼 OpenAI 兼容接口，响应 `model` 为 `qwen3.7-plus` 且回复 `OK`；公网 `/healthz` 返回 `ok:true`，首页返回 `HTTP/2 200`。
- 回滚方式：将 `/etc/wuhao-zhiyuan.env` 中 `DASHSCOPE_MODEL` 改回上一模型并重启 `wuhao-zhiyuan.service`；代码层可恢复本次提交前版本后重新部署。
