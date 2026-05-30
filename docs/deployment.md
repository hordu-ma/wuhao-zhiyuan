# 部署说明

## 当前状态

- 应用服务端口：`18082`
- 本机验证地址：`http://127.0.0.1:18082`
- 生产目标机：阿里云 ECS `121.199.173.244`，即 `horsduroot.com` / `www.horsduroot.com` 当前所在机器。
- 生产访问地址：`https://zhiyuan.horsduroot.com`
- 生产应用目录：`/opt/wuhao-zhiyuan`
- 生产环境文件：`/etc/wuhao-zhiyuan.env`
- 生产 systemd 服务：`wuhao-zhiyuan.service`
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
