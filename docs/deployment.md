# 部署说明

## 当前状态

- 应用服务端口：`18082`
- 本机验证地址：`http://127.0.0.1:18082`
- 生产目标机：阿里云 ECS `121.199.173.244`，即 `horsduroot.com` / `www.horsduroot.com` 当前所在机器。
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

## 当前阻塞

- `zhiyuan.horsduroot.com` 当前 DNS 未解析，`dig +short zhiyuan.horsduroot.com` 无结果。
- `horsduroot.com` 和 `www.horsduroot.com` 当前解析到 `121.199.173.244`。
- `wuhao-tutor` 仓库记录生产部署依赖本机 SSH alias `wuhao-tutor-ecs` 和私钥 `wuhao-ecs.pem`。
- 当前机器只有 `/home/pgx/asset-base/internal/五好爱学/wuhao-tutor.pem`，该 key 对 `root@121.199.173.244`、`ubuntu@121.199.173.244`、`ecs-user@121.199.173.244` 等常见用户均返回 `Permission denied (publickey)`。
- 当前机器未找到 `wuhao-ecs.pem` 或阿里云 CLI 凭据，因此无法完成生产 ECS 登录和反代写入。

## 生产部署命令

拿到 `wuhao-ecs.pem` 后，可在本机添加 SSH 配置：

```sshconfig
Host wuhao-tutor-ecs
    HostName 121.199.173.244
    User root
    IdentityFile ~/.ssh/wuhao-ecs.pem
    IdentitiesOnly yes
```

然后执行：

```bash
ssh wuhao-tutor-ecs 'mkdir -p /opt/wuhao-zhiyuan'
ssh wuhao-tutor-ecs 'test -d /opt/wuhao-zhiyuan/.git || git clone git@github.com:hordu-ma/wuhao-zhiyuan.git /opt/wuhao-zhiyuan'
ssh wuhao-tutor-ecs 'cd /opt/wuhao-zhiyuan && git pull --ff-only && npm install --omit=dev'
ssh wuhao-tutor-ecs 'cat >/etc/systemd/system/wuhao-zhiyuan.service <<EOF
[Unit]
Description=Wuhao Zhiyuan decision assistant
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/wuhao-zhiyuan
Environment=NODE_ENV=production
Environment=PORT=18082
ExecStart=/usr/bin/node /opt/wuhao-zhiyuan/src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now wuhao-zhiyuan'
```

部署后验证：

```bash
ssh wuhao-tutor-ecs 'curl -sf http://127.0.0.1:18082/ >/dev/null && echo app_ok'
curl -I -H 'Host: zhiyuan.horsduroot.com' http://121.199.173.244/
```
