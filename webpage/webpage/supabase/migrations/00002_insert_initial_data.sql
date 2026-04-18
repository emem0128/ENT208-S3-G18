-- 插入初始客服账号（密码：123456）
INSERT INTO service_staff (name, account, password, role) VALUES
('管理员', 'admin', '123456', 'admin'),
('客服1', 'staff1', '123456', 'staff');

-- 插入初始费用类型
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
('other', '其他', 99);