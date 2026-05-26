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
