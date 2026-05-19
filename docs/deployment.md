# 部署说明

## 当前状态

- 应用服务端口：`18082`
- 本机验证地址：`http://127.0.0.1:18082`
- 后台启动命令：

```bash
setsid env PORT=18082 node src/server.js > /home/pgx/code-repos/wuhao-zhiyuan/zhiyuan.log 2>&1 < /dev/null &
```

## 域名反代目标

将 `zhiyuan.horsduroot.com` 反向代理到：

```text
http://127.0.0.1:18082
```

## Nginx 示例

当前机器未安装 Nginx，且当前用户无免密 sudo。以下配置需要有服务器管理员权限后执行。

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
- 当前用户执行 `sudo -n true` 返回需要密码，无法安装/启动 Nginx 或写入系统反代配置。
- 因此当前已完成应用层部署和本机端口验证，域名级访问需补 DNS 和系统反代权限后完成。
