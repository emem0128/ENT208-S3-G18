-- 为 expense_records 表添加 is_overtime 字段
ALTER TABLE expense_records ADD COLUMN is_overtime BOOLEAN NOT NULL DEFAULT false;

-- 删除 overtime_records 表
DROP TABLE IF EXISTS overtime_records CASCADE;