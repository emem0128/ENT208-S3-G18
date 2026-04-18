-- 创建司机表
CREATE TABLE drivers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建车辆表
CREATE TABLE vehicles (
  id BIGSERIAL PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('own', 'affiliated', 'rented')),
  source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建报账记录表（核心表，兼总表）
CREATE TABLE expense_records (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  record_date DATE NOT NULL,
  plate_number TEXT NOT NULL,
  route TEXT,
  fee_weighing NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_container NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_overnight NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_vn_overtime NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_vn_key NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_parking NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_newpost NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_taxi NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_water NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_tarpaulin NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_highway NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_stamp NUMERIC(10,2) NOT NULL DEFAULT 0,
  note_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  note_detail TEXT,
  total_expense NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  receipt_images TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建加班记录表
CREATE TABLE overtime_records (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  overtime_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driver_id, overtime_date)
);

-- 创建客服人员表
CREATE TABLE service_staff (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建备用金充值记录表
CREATE TABLE advance_fund_records (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  amount NUMERIC(10,2) NOT NULL,
  fund_date DATE NOT NULL,
  month TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建费用类型配置表
CREATE TABLE fee_types (
  id BIGSERIAL PRIMARY KEY,
  field_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 创建更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 expense_records 表添加触发器
CREATE TRIGGER update_expense_records_updated_at
  BEFORE UPDATE ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 插入13个司机初始数据
INSERT INTO drivers (name, username, password) VALUES
  ('徐良斌', 'xuliangbin', '123456'),
  ('陆贻祥', 'luyixiang', '123456'),
  ('仇兆春', 'qiuzhaochun', '123456'),
  ('黄崇开', 'huangchongkai', '123456'),
  ('农建海', 'nongjianhai', '123456'),
  ('吴子新', 'wuzixin', '123456'),
  ('谭德光', 'tandeguang', '123456'),
  ('韦成碧', 'weichengbi', '123456'),
  ('姚厚东', 'yaohoudong', '123456'),
  ('秦林勇', 'qinlinyong', '123456'),
  ('李鉴钊', 'lijianzhao', '123456'),
  ('莫继凡', 'mojifan', '123456'),
  ('严星星', 'yanxingxing', '123456');

-- 插入45个车牌初始数据
INSERT INTO vehicles (plate_number, vehicle_type) VALUES
  ('桂FB6657', 'own'),
  ('桂FB0967', 'own'),
  ('桂FB9093', 'own'),
  ('桂FB0797', 'own'),
  ('桂FB2656', 'own'),
  ('桂FB2258', 'own'),
  ('桂FB1629', 'own'),
  ('桂FB1850', 'own'),
  ('桂FB5218', 'own'),
  ('桂FB8358', 'own'),
  ('桂FB8607', 'own'),
  ('桂FB6379', 'own'),
  ('桂FB8625', 'own'),
  ('桂FB7619', 'own'),
  ('桂FB3978', 'own'),
  ('桂FB3326', 'own'),
  ('桂FB3325', 'own'),
  ('桂FB8067', 'own'),
  ('桂FB0979', 'own'),
  ('桂FB5802', 'own'),
  ('桂FB6609', 'own'),
  ('桂FB6659', 'own'),
  ('桂FB9918', 'own'),
  ('桂FB8772', 'own'),
  ('桂FB7909', 'own'),
  ('桂FB7697', 'own'),
  ('桂FB8198', 'own'),
  ('桂FB3391', 'own'),
  ('桂FB1391', 'own'),
  ('桂FB2822', 'own'),
  ('桂FB2152', 'own'),
  ('桂FB7889', 'own'),
  ('桂FB6679', 'own'),
  ('桂FB2879', 'own'),
  ('桂FB6608', 'own'),
  ('桂FB6209', 'own'),
  ('桂AV6011', 'own'),
  ('桂A3K79S', 'own'),
  ('桂FR2708', 'own'),
  ('桂FB6011', 'own'),
  ('鲁FV8581', 'own'),
  ('鲁L71550', 'own'),
  ('鄂ARK618', 'own'),
  ('粤BBA293', 'own'),
  ('粤BGW559', 'own');

-- 插入费用类型初始数据
INSERT INTO fee_types (field_name, display_name, sort_order) VALUES
  ('fee_weighing', '过磅费', 1),
  ('fee_container', '提柜费', 2),
  ('fee_overnight', '过夜费', 3),
  ('fee_vn_overtime', '越南超时费', 4),
  ('fee_vn_key', '越南收钥匙', 5),
  ('fee_parking', '停车费', 6),
  ('fee_newpost', '新岗', 7),
  ('fee_taxi', '打车', 8),
  ('fee_water', '淋水', 9),
  ('fee_tarpaulin', '解篷布', 10),
  ('fee_highway', '高速费', 11),
  ('fee_stamp', '盖章', 12),
  ('other', '其他', 13);

-- 插入客服管理员初始数据
INSERT INTO service_staff (username, password, name, role) VALUES
  ('admin', 'admin123', '管理员', 'admin');

-- 插入一些示例报账记录
INSERT INTO expense_records (driver_id, record_date, plate_number, route, fee_parking, fee_stamp, total_expense, commission, status) VALUES
  (1, '2026-03-05', '桂FB6657', '越南—桂福', 50, 10, 60, 60, 'pending'),
  (1, '2026-03-05', '桂FB0967', '北投', 20, 0, 20, 0, 'confirmed');

-- 插入一些示例备用金记录
INSERT INTO advance_fund_records (driver_id, amount, fund_date, month, note) VALUES
  (1, 1000, '2025-12-31', '2026-01', ''),
  (1, 1000, '2026-01-08', '2026-01', ''),
  (1, 500, '2026-01-15', '2026-01', ''),
  (1, 1000, '2026-01-21', '2026-01', ''),
  (1, 1000, '2026-01-26', '2026-01', '');

-- 启用 RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_fund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;

-- drivers 表策略：司机只能查看自己的信息
CREATE POLICY "司机可以查看自己的信息" ON drivers
  FOR SELECT USING (true);

-- vehicles 表策略：所有人可以查看车辆信息
CREATE POLICY "所有人可以查看车辆信息" ON vehicles
  FOR SELECT USING (true);

-- expense_records 表策略：司机只能查看和修改自己的报账记录
CREATE POLICY "司机可以查看自己的报账记录" ON expense_records
  FOR SELECT USING (true);

CREATE POLICY "司机可以插入自己的报账记录" ON expense_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "司机可以修改待确认的报账记录" ON expense_records
  FOR UPDATE USING (status = 'pending');

-- overtime_records 表策略
CREATE POLICY "司机可以查看自己的加班记录" ON overtime_records
  FOR SELECT USING (true);

CREATE POLICY "司机可以插入自己的加班记录" ON overtime_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "司机可以删除自己的加班记录" ON overtime_records
  FOR DELETE USING (true);

-- advance_fund_records 表策略
CREATE POLICY "司机可以查看自己的备用金记录" ON advance_fund_records
  FOR SELECT USING (true);

-- fee_types 表策略：所有人可以查看费用类型
CREATE POLICY "所有人可以查看费用类型" ON fee_types
  FOR SELECT USING (true);

-- 创建图片存储 bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('app-a2kae62wkbnl_receipt_images', 'app-a2kae62wkbnl_receipt_images', true);

-- 设置 bucket 策略：所有人可以上传和查看图片
CREATE POLICY "所有人可以上传凭证图片" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'app-a2kae62wkbnl_receipt_images');

CREATE POLICY "所有人可以查看凭证图片" ON storage.objects
  FOR SELECT USING (bucket_id = 'app-a2kae62wkbnl_receipt_images');