# 五好智学｜志愿填报辅助决策系统

面向高考志愿填报场景的一期闭环系统，包含品牌首页、手机号注册登录、16型人格倾向测评、AI志愿对话、带五好智学水印的 PDF 咨询报告。

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

未配置阿里云密钥时，系统会使用本地 mock 志愿建议，详见 `tasks.md`。
