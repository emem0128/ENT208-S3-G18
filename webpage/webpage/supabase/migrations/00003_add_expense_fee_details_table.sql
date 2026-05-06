-- 费用明细拆分子表：用于存储每种费用的具体地址及金额说明
CREATE TABLE IF NOT EXISTS expense_fee_details (
  id BIGSERIAL PRIMARY KEY,
  expense_record_id BIGINT NOT NULL REFERENCES expense_records(id) ON DELETE CASCADE,
  fee_field_name TEXT NOT NULL,
  detail_location TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_fee_details_record_id
  ON expense_fee_details(expense_record_id);

CREATE INDEX IF NOT EXISTS idx_expense_fee_details_field
  ON expense_fee_details(fee_field_name);

ALTER TABLE expense_fee_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "客服可以查看费用明细" ON expense_fee_details
  FOR SELECT USING (true);

CREATE POLICY "客服可以插入费用明细" ON expense_fee_details
  FOR INSERT WITH CHECK (true);

CREATE POLICY "客服可以修改费用明细" ON expense_fee_details
  FOR UPDATE USING (true);

CREATE POLICY "客服可以删除费用明细" ON expense_fee_details
  FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION set_expense_fee_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_fee_details_updated_at ON expense_fee_details;
CREATE TRIGGER trg_expense_fee_details_updated_at
  BEFORE UPDATE ON expense_fee_details
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_fee_details_updated_at();
