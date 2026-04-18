# 数据库管理指南

## 📊 数据库概览

**数据库地址**: https://rwjbladqwubgjotlygyy.supabase.co
**管理后台**: https://supabase.com/dashboard

## 🗄️ 数据表结构

### 1. drivers（司机表）
存储司机基本信息和登录凭证

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| name | text | 司机姓名 |
| username | text | 登录账号（唯一） |
| password | text | 登录密码 |
| is_active | boolean | 是否在职 |
| created_at | timestamptz | 创建时间 |

**当前数据**: 13个司机

### 2. vehicles（车辆表）
存储公司车辆信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| plate_number | text | 车牌号（唯一） |
| vehicle_type | text | 车辆类型（own/affiliated/rented） |
| source | text | 来源说明 |
| is_active | boolean | 是否在用 |
| created_at | timestamptz | 创建时间 |

**当前数据**: 45个车牌

### 3. expense_records（报账记录表）⭐核心表
存储所有报账记录，status="confirmed" 的记录即为总表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| driver_id | bigint | 关联司机ID |
| record_date | date | 费用发生日期 |
| plate_number | text | 车牌号 |
| route | text | 路线/地点 |
| fee_weighing | numeric | 过磅费 |
| fee_container | numeric | 提柜费 |
| fee_overnight | numeric | 过夜费 |
| fee_vn_overtime | numeric | 越南超时费 |
| fee_vn_key | numeric | 越南收钥匙 |
| fee_parking | numeric | 停车费 |
| fee_newpost | numeric | 新岗 |
| fee_taxi | numeric | 打车 |
| fee_water | numeric | 淋水 |
| fee_tarpaulin | numeric | 解篷布 |
| fee_highway | numeric | 高速费 |
| fee_stamp | numeric | 盖章 |
| note_amount | numeric | 其他费用金额 |
| note_detail | text | 其他费用说明 |
| total_expense | numeric | 费用合计 |
| commission | numeric | 提成 |
| receipt_images | text[] | 凭证图片URL数组 |
| status | text | 状态（pending/confirmed） |
| confirmed_by | text | 确认人 |
| confirmed_at | timestamptz | 确认时间 |
| is_overtime | boolean | 是否加班 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 4. fee_types（费用类型配置表）
存储费用类型配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| field_name | text | 数据库字段名 |
| display_name | text | 显示名称 |
| sort_order | integer | 排序 |
| is_active | boolean | 是否启用 |

**当前数据**: 13种费用类型

### 5. service_staff（客服人员表）
存储客服人员信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| username | text | 登录账号 |
| password | text | 登录密码 |
| name | text | 姓名 |
| role | text | 角色（admin/staff） |
| created_at | timestamptz | 创建时间 |

**当前数据**: 1个管理员（admin/admin123）

### 6. advance_fund_records（备用金充值记录表）
存储备用金充值记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| driver_id | bigint | 关联司机ID |
| amount | numeric | 充值金额 |
| fund_date | date | 充值日期 |
| month | text | 所属月份（YYYY-MM） |
| note | text | 备注 |
| created_at | timestamptz | 创建时间 |

## 🔒 安全策略（RLS）

### drivers 表
- ✅ 所有人可以查看司机信息（用于登录验证）

### vehicles 表
- ✅ 所有人可以查看车辆信息（用于车牌搜索）

### expense_records 表
- ✅ 司机可以插入自己的报账记录
- ✅ 司机可以查看自己的报账记录
- ✅ 司机可以修改待确认的报账记录（status='pending'）

### fee_types 表
- ✅ 所有人可以查看费用类型

### advance_fund_records 表
- ✅ 司机可以查看自己的备用金记录

## 📦 存储桶

### app-a2kae62wkbnl_receipt_images
- **类型**: 公开访问
- **用途**: 存储报账凭证图片
- **路径格式**: `{driver_id}/{timestamp}_{filename}`

## 🔧 常用 SQL 查询

### 查询所有待确认的记录
```sql
SELECT 
  e.*,
  d.name as driver_name
FROM expense_records e
JOIN drivers d ON e.driver_id = d.id
WHERE e.status = 'pending'
ORDER BY e.record_date DESC, e.created_at DESC;
```

### 查询某个司机的月度统计
```sql
SELECT 
  DATE_TRUNC('month', record_date) as month,
  COUNT(*) as record_count,
  SUM(total_expense) as total_expense,
  SUM(commission) as total_commission,
  COUNT(DISTINCT CASE WHEN is_overtime THEN record_date END) as overtime_days
FROM expense_records
WHERE driver_id = 1
  AND status = 'confirmed'
GROUP BY DATE_TRUNC('month', record_date)
ORDER BY month DESC;
```

### 查询总表（所有已确认的记录）
```sql
SELECT 
  e.*,
  d.name as driver_name
FROM expense_records e
JOIN drivers d ON e.driver_id = d.id
WHERE e.status = 'confirmed'
ORDER BY e.record_date DESC, e.created_at DESC;
```

### 查询某月的备用金余额
```sql
-- 某个司机某月的备用金余额
WITH fund_summary AS (
  SELECT 
    driver_id,
    SUM(amount) as total_fund
  FROM advance_fund_records
  WHERE driver_id = 1
    AND month = '2026-03'
  GROUP BY driver_id
),
expense_summary AS (
  SELECT 
    driver_id,
    SUM(total_expense) as total_expense
  FROM expense_records
  WHERE driver_id = 1
    AND status = 'confirmed'
    AND DATE_TRUNC('month', record_date) = '2026-03-01'
  GROUP BY driver_id
)
SELECT 
  COALESCE(f.total_fund, 0) as total_fund,
  COALESCE(e.total_expense, 0) as total_expense,
  COALESCE(f.total_fund, 0) - COALESCE(e.total_expense, 0) as balance
FROM fund_summary f
FULL OUTER JOIN expense_summary e ON f.driver_id = e.driver_id;
```

### 添加新司机
```sql
INSERT INTO drivers (name, username, password, is_active)
VALUES ('新司机', 'newdriver', '123456', true);
```

### 添加新车辆
```sql
INSERT INTO vehicles (plate_number, vehicle_type, source, is_active)
VALUES ('桂FB0000', 'own', NULL, true);
```

### 添加备用金充值记录
```sql
INSERT INTO advance_fund_records (driver_id, amount, fund_date, month, note)
VALUES (1, 1000, '2026-03-06', '2026-03', '备用金充值');
```

### 确认报账记录
```sql
UPDATE expense_records
SET 
  status = 'confirmed',
  confirmed_by = '客服姓名',
  confirmed_at = NOW(),
  commission = 60  -- 根据实际情况设置提成
WHERE id = 1;
```

### 查询车牌使用频率
```sql
SELECT 
  plate_number,
  COUNT(*) as usage_count,
  SUM(total_expense) as total_expense
FROM expense_records
WHERE status = 'confirmed'
GROUP BY plate_number
ORDER BY usage_count DESC;
```

## 🛠️ 维护任务

### 定期任务

1. **每月初**
   - 导出上月总表数据
   - 备份数据库
   - 检查数据完整性

2. **每周**
   - 检查待确认记录数量
   - 清理过期的暂存数据

3. **按需**
   - 添加新司机
   - 添加新车辆
   - 充值备用金
   - 修改费用类型

### 数据备份

建议使用 Supabase 管理后台的自动备份功能，或定期导出数据：

```bash
# 使用 pg_dump 导出数据（需要数据库连接字符串）
pg_dump "postgresql://..." > backup_$(date +%Y%m%d).sql
```

## 📞 技术支持

如需数据库相关支持，请联系技术团队。

---

**最后更新**: 2026-03-06
