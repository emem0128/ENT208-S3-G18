# 司机报账微信小程序 - 快速启动指南

## 🎯 项目简介

这是一个为物流公司短驳司机设计的报账微信小程序，支持：
- 每日费用报账提交
- 多车辆多趟次管理
- 凭证图片上传
- 加班记录
- 备用金管理
- 报账记录查询和编辑

## 📦 环境要求

- Node.js 16+
- pnpm（推荐）或 npm
- 微信开发者工具

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
# 或
npm install
```

### 2. 配置数据库

数据库已配置完成，连接信息在 `.env` 文件中：

```env
TARO_APP_SUPABASE_URL=https://rwjbladqwubgjotlygyy.supabase.co
TARO_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TARO_APP_APP_ID=app-a2kae62wkbnl
```

### 3. 启动开发服务器

#### 微信小程序
```bash
npm run dev:weapp
```

然后：
1. 打开微信开发者工具
2. 导入项目，选择 `dist` 目录
3. 开始开发和调试

#### H5 网页版（用于快速调试）
```bash
npm run dev:h5
```

浏览器访问：http://localhost:10086

### 4. 构建生产版本

```bash
# 微信小程序
npm run build:weapp

# H5 网页版
npm run build:h5
```

## 🔐 测试账号

### 司机账号（任选一个）

| 姓名 | 账号 | 密码 |
|------|------|------|
| 徐良斌 | xuliangbin | 123456 |
| 陆贻祥 | luyixiang | 123456 |
| 仇兆春 | qiuzhaochun | 123456 |
| 黄崇开 | huangchongkai | 123456 |
| 农建海 | nongjianhai | 123456 |

更多账号请查看 `PROJECT_STATUS.md`

## 📱 功能测试流程

### 1. 登录
- 使用任一司机账号登录
- 账号：xuliangbin
- 密码：123456

### 2. 提交报账
1. 进入"报账"页面（首页）
2. 选择日期（默认今天）
3. 如果加班，打开"是否加班"开关
4. 填写车辆信息：
   - 输入车牌号（如：桂FB6657）
   - 选择路线/地点（选填）
   - 添加费用明细（下拉选择费用类型+输入金额）
   - 上传凭证图片（选填）
5. 如有多辆车，点击"+ 添加车辆"
6. 点击"提交报账"

### 3. 查看记录
1. 进入"记录"页面
2. 选择月份查看
3. 查看当月汇总数据
4. 点击记录查看详情
5. 待确认的记录可以编辑

### 4. 编辑记录
1. 在记录列表中找到待确认的记录
2. 点击"编辑"按钮
3. 修改信息后保存
4. 注意：已确认的记录无法编辑

### 5. 查看个人信息
1. 进入"我的"页面
2. 查看个人信息
3. 选择月份查看备用金明细
4. 查看加班统计

## 🛠️ 开发命令

```bash
# 代码检查
npm run lint

# 构建测试
npm run build:weapp
npm run build:h5
```

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

## 🔍 常见问题

### Q: 登录失败怎么办？
A: 检查：
1. 数据库连接是否正常
2. 账号密码是否正确
3. 网络连接是否正常

### Q: 图片上传失败？
A: 检查：
1. 图片大小是否超过限制
2. 网络连接是否正常
3. 存储桶配置是否正确

### Q: 车牌搜索不到？
A: 
1. 车牌可能不在车辆库中
2. 可以手动输入，系统会显示橙色边框提示
3. 不影响提交，确认后可继续

### Q: 无法编辑记录？
A: 
1. 检查记录状态是否为"待确认"
2. 已确认的记录已锁定，无法编辑
3. 只能编辑自己提交的记录

## 📞 技术支持

如有问题，请查看：
- `PROJECT_STATUS.md` - 项目状态和详细说明
- `TODO.md` - 开发任务和注意事项
- `docs/prd.md` - 产品需求文档

## 🎉 开始使用

现在您可以开始使用司机报账小程序了！

1. 运行 `npm run dev:weapp`
2. 打开微信开发者工具
3. 使用测试账号登录
4. 开始体验功能

祝您使用愉快！ 🚀
