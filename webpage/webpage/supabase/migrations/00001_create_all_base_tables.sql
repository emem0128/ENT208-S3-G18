-- 1. 客服人员表
CREATE TABLE service_staff (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 司机信息表
CREATE TABLE drivers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 车辆信息表
CREATE TABLE vehicles (
  id BIGSERIAL PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('own', 'affiliated', 'rented')),
  source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 费用类型配置表
CREATE TABLE fee_types (
  id BIGSERIAL PRIMARY KEY,
  field_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 报账记录表（核心表 兼 总表）
CREATE TABLE expense_records (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  record_date DATE NOT NULL,
  plate_number TEXT NOT NULL,
  route TEXT,
  fee_weighing NUMERIC(10,2) DEFAULT 0,
  fee_container NUMERIC(10,2) DEFAULT 0,
  fee_overnight NUMERIC(10,2) DEFAULT 0,
  fee_vn_overtime NUMERIC(10,2) DEFAULT 0,
  fee_vn_key NUMERIC(10,2) DEFAULT 0,
  fee_parking NUMERIC(10,2) DEFAULT 0,
  fee_newpost NUMERIC(10,2) DEFAULT 0,
  fee_taxi NUMERIC(10,2) DEFAULT 0,
  fee_water NUMERIC(10,2) DEFAULT 0,
  fee_tarpaulin NUMERIC(10,2) DEFAULT 0,
  fee_highway NUMERIC(10,2) DEFAULT 0,
  fee_stamp NUMERIC(10,2) DEFAULT 0,
  note_amount NUMERIC(10,2) DEFAULT 0,
  note_detail TEXT,
  total_expense NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission NUMERIC(10,2) DEFAULT 0,
  receipt_images TEXT[],
  is_overtime BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 备用金充值记录表
CREATE TABLE advance_fund_records (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  amount NUMERIC(10,2) NOT NULL,
  recharge_date DATE NOT NULL,
  month TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. 操作日志表
CREATE TABLE operation_logs (
  id BIGSERIAL PRIMARY KEY,
  operator_id BIGINT NOT NULL REFERENCES service_staff(id),
  operator_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('confirm', 'edit', 'create', 'update', 'delete')), 
  target_type TEXT NOT NULL CHECK (target_type IN ('expense_record', 'driver', 'vehicle', 'advance_fund', 'fee_type', 'staff')), 
  target_id BIGINT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE service_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_fund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略

-- service_staff 表
CREATE POLICY "客服可以查看所有客服信息" ON service_staff
  FOR SELECT USING (true);

CREATE POLICY "管理员可以插入客服" ON service_staff
  FOR INSERT WITH CHECK (true);

CREATE POLICY "管理员可以修改客服" ON service_staff
  FOR UPDATE USING (true);

-- drivers 表
CREATE POLICY "客服可以查看所有司机" ON drivers
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入司机" ON drivers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "客服可以修改司机信息" ON drivers
  FOR UPDATE USING (true);

-- vehicles 表
CREATE POLICY "客服可以查看所有车辆" ON vehicles
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入车辆" ON vehicles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "客服可以修改车辆" ON vehicles
  FOR UPDATE USING (true);

-- fee_types 表
CREATE POLICY "客服可以查看所有费用类型" ON fee_types
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入费用类型" ON fee_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "客服可以修改费用类型" ON fee_types
  FOR UPDATE USING (true);

-- expense_records 表
CREATE POLICY "客服可以查看所有报账记录" ON expense_records
  FOR SELECT USING (true);

CREATE POLICY "客服可以修改待确认的记录" ON expense_records
  FOR UPDATE USING (status = 'pending');

-- advance_fund_records 表
CREATE POLICY "客服可以查看所有备用金记录" ON advance_fund_records
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入备用金记录" ON advance_fund_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "客服可以修改备用金记录" ON advance_fund_records
  FOR UPDATE USING (true);

CREATE POLICY "客服可以删除备用金记录" ON advance_fund_records
  FOR DELETE USING (true);

-- operation_logs 表
CREATE POLICY "客服可以查看所有日志" ON operation_logs
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入日志" ON operation_logs
  FOR INSERT WITH CHECK (true);