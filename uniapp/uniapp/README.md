# 司机报账微信小程序

这是一个为物流公司短驳司机设计的报账微信小程序，支持每日费用报账、多车辆管理、凭证上传、加班记录和备用金管理。

## 🎯 项目简介

**使用人群**: 公司短驳货运司机（约13人）

**核心场景**: 司机每天跑多趟短驳，每趟可能开不同的车。一天结束后统一提交当天所有车辆的费用报账。客服在网页端逐条确认后自动录入总表。

**技术栈**: Taro + React + TypeScript + Tailwind CSS + Supabase

---

## 📱 主要功能

### 1. 登录系统
- 用户名+密码登录
- 登录状态保持
- 13个司机账号（初始密码：123456）

### 2. 报账提交（首页）
- 日期选择和加班标记
- 多车辆卡片管理（每个卡片=一辆车的一趟任务）
- 车牌智能搜索（实时匹配车辆库）
- 费用明细录入（13种费用类型）
- 凭证图片上传（最多9张，自动压缩）
- 费用实时计算
- 自动暂存功能（防止数据丢失）

### 3. 报账记录
- 按月查询记录
- 当月汇总统计（支出、提成、加班次数）
- 记录详情查看
- 待确认记录可编辑
- 已确认记录锁定

### 4. 个人中心
- 个人信息展示
- 备用金明细查询
- 加班统计和加班费计算
- 退出登录

---

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发

```bash
# 微信小程序（需要微信开发者工具）
npm run dev:weapp

# H5 网页版（快速调试）
npm run dev:h5
```

### 代码检查

```bash
npm run lint
```

### 测试账号

| 姓名 | 账号 | 密码 |
|------|------|------|
| 徐良斌 | xuliangbin | 123456 |
| 陆贻祥 | luyixiang | 123456 |
| 仇兆春 | qiuzhaochun | 123456 |

更多账号请查看 [PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## 📂 项目结构

```
src/
├── pages/              # 页面
│   ├── login/         # 登录页
│   ├── submit/        # 报账提交页（首页）
│   ├── records/       # 报账记录页
│   ├── record-detail/ # 记录详情页
│   ├── record-edit/   # 记录编辑页
│   └── profile/       # 我的页面
├── components/        # 组件
│   ├── VehicleCard.tsx    # 车辆卡片组件
│   ├── FeeRow.tsx         # 费用行组件
│   └── RouteGuard.tsx     # 路由守卫组件
├── db/               # 数据库
│   ├── api.ts        # API 封装
│   └── types.ts      # 类型定义
├── contexts/         # 上下文
│   └── AuthContext.tsx    # 认证上下文
├── utils/            # 工具函数
│   └── upload.ts     # 图片上传工具
└── client/           # 客户端
    └── supabase.ts   # Supabase 客户端
```

---

## 🗄️ 数据库

### 数据表（6张）

1. **drivers** - 司机表（13个司机）
2. **vehicles** - 车辆表（45个车牌）
3. **expense_records** - 报账记录表（核心表）
4. **fee_types** - 费用类型配置表（13种费用类型）
5. **service_staff** - 客服人员表（1个管理员）
6. **advance_fund_records** - 备用金充值记录表

### 数据库配置

数据库连接信息在 `.env` 文件中：

```env
TARO_APP_SUPABASE_URL=https://rwjbladqwubgjotlygyy.supabase.co
TARO_APP_SUPABASE_ANON_KEY=...
TARO_APP_APP_ID=app-a2kae62wkbnl
```

详细的数据库管理指南请查看 [DATABASE_GUIDE.md](./DATABASE_GUIDE.md)

---

## 📚 文档

- [QUICK_START.md](./QUICK_START.md) - 快速启动指南
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 项目状态和详细说明
- [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) - 数据库管理指南
- [CHECKLIST.md](./CHECKLIST.md) - 项目检查清单
- [TODO.md](./TODO.md) - 开发任务和注意事项
- [docs/prd.md](./docs/prd.md) - 产品需求文档

---

## 🔐 安全说明

- 使用 Supabase RLS（行级安全）策略
- 司机只能查看和修改自己的数据
- 待确认的记录可编辑，已确认的记录锁定
- 图片存储在公开存储桶中

---

## 🎯 业务流程

```
司机提交报账 → 状态：待确认
      ↓
司机可随时修改（客服也可以在网页端修改）
      ↓
客服在网页端逐条确认 → 状态变为已确认 → 自动进入总表
      ↓
已确认的记录锁定，不可再修改
```

**总表 = expense_records 表中 status="confirmed" 的所有记录**

---

## 🛠️ 技术特性

1. **自动暂存**: 报账页面数据实时保存到本地缓存
2. **智能搜索**: 车牌输入时实时匹配车辆库
3. **图片压缩**: 自动压缩到1MB以内
4. **数据安全**: RLS 策略确保司机只能访问自己的数据
5. **实时计算**: 费用合计自动计算
6. **加班统计**: 按天去重，避免重复计算

---

## 📊 项目状态

- ✅ 所有功能已完成
- ✅ Lint 检查通过
- ✅ 数据库连接测试通过
- ✅ 已接入本地数据库
- ✅ 可以正常使用

---

## 🔄 后续开发

- 客服管理网页（共用同一个数据库）
  - 查看/修改/确认报账
  - 管理车辆库
  - 管理司机
  - 充值备用金
  - 查看和导出总表

---

## 📞 技术支持

如有问题，请查看项目文档或联系技术团队。

---

## Repository Structure (Technical Details)

The project structure is as follows:

```

├── babel.config.js
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── project.config.json
├── README.md
├── tailwind.config.js
├── tsconfig.check.json
├── tsconfig.json
├── config/
│   ├── dev.ts
│   ├── index.ts
│   └── prod.ts
├── scripts/
├── src/
│   ├── app.config.ts               # Taro app configuration, defining routes and tabBar
│   ├── app.scss
│   ├── app.tsx
│   ├── index.html
│   ├── client/
│   │   └── supabase.ts             # Supabase client configuration
│   ├── components/                 # Reusable components
│   │   ├── VehicleCard.tsx
│   │   ├── FeeRow.tsx
│   │   └── RouteGuard.tsx
│   ├── contexts/                   # React contexts
│   │   └── AuthContext.tsx
│   ├── db/                         # Database operations and Supabase integration
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── README.md
│   ├── pages/                      # Pages (each folder corresponds to a route)
│   │   ├── login/
│   │   ├── submit/
│   │   ├── records/
│   │   ├── record-detail/
│   │   ├── record-edit/
│   │   └── profile/
│   ├── store/                      # Global state management using Zustand
│   │   └── README.md
│   ├── utils/                      # Utility functions
│   │   └── upload.ts
│   └── types/                      # TypeScript type definitions
│       └── global.d.ts
├── supabase/
│   ├── config.toml
│   └── migrations/
└── docs/
    └── prd.md                      # Product requirements document
```

---

## Installation and Setup

```bash
pnpm install # Install dependencies
```

```bash
pnpm run lint  # Lint source (Important: After modifying the code, please execute this command to perform necessary checks.)
```

---

**Last Updated**: 2026-03-06
**Status**: ✅ Ready for use
