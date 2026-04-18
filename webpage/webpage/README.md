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

## 环境变量

在 `.env` 中配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ID`
