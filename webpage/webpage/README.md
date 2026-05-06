# 客服后台管理网页

司机报账系统的客服端后台项目，用于管理司机报账记录、司机和车辆信息、费用类型、备用金及操作日志。

## 技术栈

- Vite
- React
- TypeScript
- Supabase

## 目录结构

```text
.
├── src
│   ├── pages           # 业务页面
│   ├── components      # 组件与 UI
│   ├── contexts        # 全局上下文（含登录态）
│   ├── db              # 数据访问封装
│   ├── hooks           # 通用 hooks
│   ├── lib             # 工具函数与客户端
│   └── routes.tsx      # 路由配置
├── public              # 静态资源
├── supabase            # SQL 迁移脚本
└── vite.config.ts      # Vite 配置
```

## 本地开发

```bash
npm install
npm run dev
```

## 代码检查

```bash
npm run lint
```

## OCR 代理配置

法律咨询 Chat 的图片识别会请求 `/api/ocr/recognize`。本地开发环境已在 `vite.config.dev.ts` 中代理到 `http://119.91.129.106`；生产环境需要在服务器 Nginx 配置中把 `/api/ocr/` 反代到 OCR 代理服务。

在 `/etc/nginx/sites-enabled/mashangguoji` 的现有 `location /` 之前添加：

```nginx
location /api/ocr/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin "";

    client_max_body_size 12M;
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;
}
```

配置后执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 环境变量

在 `.env` 中配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ID`

## JT808 TCP 服务部署

项目根目录新增了 [jt808-server/index.js](/Users/mxy/Desktop/mashang%20project_副本/webpage/webpage/jt808-server/index.js)、[jt808-server/package.json](/Users/mxy/Desktop/mashang%20project_副本/webpage/webpage/jt808-server/package.json) 和 [jt808-server/ecosystem.config.js](/Users/mxy/Desktop/mashang%20project_副本/webpage/webpage/jt808-server/ecosystem.config.js)，用于单独部署 JT/T 808 TCP 服务。

### 部署前准备

1. 修改 `jt808-server/ecosystem.config.js` 中的 `SUPABASE_URL` 和 `SUPABASE_KEY`
2. 确认腾讯云服务器已安装 Node.js、PM2、rsync 和 OpenSSH
3. 按需修改根目录 [deploy.sh](/Users/mxy/Desktop/mashang%20project_副本/webpage/webpage/deploy.sh) 里的 `SERVER_HOST`

### 部署命令

```bash
chmod +x deploy.sh
./deploy.sh
```

### 服务器端 PM2 运维命令

```bash
pm2 status
pm2 logs jt808
pm2 restart jt808
pm2 stop jt808
pm2 monit
```
