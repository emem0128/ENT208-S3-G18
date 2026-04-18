# 数据库配置说明

## 📍 配置位置

数据库连接信息已硬编码在以下文件中：

**文件路径**: `src/client/supabase.ts`

## 🔧 当前配置

```typescript
// Supabase 数据库配置（本地数据库）
const supabaseUrl: string = 'https://rwjbladqwubgjotlygyy.supabase.co'
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amJsYWRxd3ViZ2pvdGx5Z3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDUwNTYsImV4cCI6MjA4ODgyMTA1Nn0.dR9w2xmK9UpbNfO_dEAnJ2FqXcj1S2vQ15xexzskhA4'
const appId: string = 'app-a2kae62wkbnl'
```

## 📝 配置说明

### 为什么硬编码？

1. **简化部署**: 不需要配置环境变量，直接构建即可使用
2. **避免配置错误**: 减少因环境变量配置错误导致的问题
3. **便于维护**: 配置集中在一个文件中，易于查找和修改

### 配置项说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| supabaseUrl | https://rwjbladqwubgjotlygyy.supabase.co | Supabase 数据库地址 |
| supabaseAnonKey | eyJhbGci... | Supabase 匿名访问密钥 |
| appId | app-a2kae62wkbnl | 应用 ID（用于存储键） |

## 🔄 如何修改配置

如果需要切换到其他数据库，请按以下步骤操作：

### 步骤 1: 打开配置文件

```bash
# 编辑文件
vim src/client/supabase.ts
# 或使用其他编辑器
```

### 步骤 2: 修改配置值

找到以下代码：

```typescript
const supabaseUrl: string = 'https://rwjbladqwubgjotlygyy.supabase.co'
const supabaseAnonKey: string = 'eyJhbGci...'
```

替换为新的数据库地址和密钥。

### 步骤 3: 保存并重新构建

```bash
# 运行 lint 检查
npm run lint

# 重新构建项目
npm run build:weapp
# 或
npm run build:h5
```

## 🔒 安全说明

### ANON_KEY 的安全性

- **ANON_KEY** 是公开密钥，可以安全地硬编码在客户端代码中
- 它只提供受限的数据库访问权限
- 实际的数据访问权限由 **RLS（行级安全）策略** 控制

### RLS 策略保护

即使有人获取了 ANON_KEY，也无法：
- 访问其他司机的数据（RLS 策略限制）
- 修改已确认的记录（RLS 策略限制）
- 执行管理员操作（需要 SERVICE_ROLE_KEY）

### 不要泄露的密钥

⚠️ **绝对不要** 在客户端代码中硬编码以下密钥：
- `SERVICE_ROLE_KEY` - 服务端密钥（拥有完全访问权限）
- 数据库直连密码
- 其他敏感凭证

## 📊 数据库信息

### 管理后台

访问 Supabase 管理后台：https://supabase.com/dashboard

### 数据库统计

- **司机**: 13人
- **车辆**: 45个车牌
- **费用类型**: 13种
- **存储桶**: app-a2kae62wkbnl_receipt_images

## 🛠️ 故障排查

### 连接失败

如果遇到数据库连接失败，请检查：

1. **URL 是否正确**
   ```typescript
   const supabaseUrl: string = 'https://rwjbladqwubgjotlygyy.supabase.co'
   ```

2. **ANON_KEY 是否正确**
   - 检查是否完整复制
   - 检查是否有多余的空格或换行

3. **网络连接**
   - 确保设备可以访问互联网
   - 检查防火墙设置

4. **数据库状态**
   - 登录 Supabase 管理后台
   - 检查项目是否正常运行

### 数据访问失败

如果可以连接但无法访问数据：

1. **检查 RLS 策略**
   - 登录 Supabase 管理后台
   - 查看表的 RLS 策略是否正确配置

2. **检查表结构**
   - 确认所有表都已创建
   - 确认字段名称正确

3. **查看错误日志**
   - 在浏览器控制台查看错误信息
   - 在 Supabase 管理后台查看日志

## 📞 技术支持

如需帮助，请：
1. 查看 [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) - 数据库管理指南
2. 查看 [QUICK_START.md](./QUICK_START.md) - 快速启动指南
3. 联系技术团队

---

**最后更新**: 2026-03-06
**配置方式**: 硬编码
**状态**: ✅ 已配置完成
