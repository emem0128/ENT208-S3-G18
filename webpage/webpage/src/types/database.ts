// 数据库类型定义

export interface ServiceStaff {
  id: number;
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'staff';
  created_at: string;
}

export interface Driver {
  id: number;
  name: string;
  username: string;
  password: string;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  vehicle_type: 'own' | 'affiliated' | 'rented';
  source?: string;
  is_active: boolean;
  created_at: string;
}

export interface FeeType {
  id: number;
  field_name: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ExpenseRecord {
  id: number;
  driver_id: number;
  record_date: string;
  plate_number: string;
  route?: string;
  fee_weighing: number;
  fee_container: number;
  fee_overnight: number;
  fee_vn_overtime: number;
  fee_vn_key: number;
  fee_parking: number;
  fee_newpost: number;
  fee_taxi: number;
  fee_water: number;
  fee_tarpaulin: number;
  fee_highway: number;
  fee_stamp: number;
  note_amount: number;
  note_detail?: string;
  total_expense: number;
  commission: number;
  receipt_images?: string[];
  is_overtime: boolean;
  status: 'pending' | 'confirmed';
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  driver?: Driver;
}

export interface AdvanceFundRecord {
  id: number;
  driver_id: number;
  amount: number;
  fund_date: string;
  month: string;
  note?: string;
  created_at: string;
  driver?: Driver;
}

export interface OperationLog {
  id: number;
  operator_id: number;
  operator_name: string;
  action: 'confirm' | 'edit' | 'create' | 'update' | 'delete';
  target_type: 'expense_record' | 'driver' | 'vehicle' | 'advance_fund' | 'fee_type' | 'staff';
  target_id: number;
  detail?: string;
  created_at: string;
}

// 扩展类型，用于前端显示
export interface ExpenseRecordWithDriver extends ExpenseRecord {
  driver: Driver;
}

export interface AdvanceFundRecordWithDriver extends AdvanceFundRecord {
  driver: Driver;
}

// 统计数据类型
export interface DashboardStats {
  todayNew: number;
  todayPending: number;
  todayConfirmed: number;
  totalPending: number;
  monthTotalExpense: number;
  monthTotalCommission: number;
  monthRecordCount: number;
  monthOvertimeDays: number;
}

export interface DriverMonthStats {
  driver_id: number;
  driver_name: string;
  record_count: number;
  total_expense: number;
  total_commission: number;
  pending_count: number;
  confirmed_count: number;
  overtime_days: number;
  advance_fund_balance: number;
}

// 备用金统计
export interface AdvanceFundStats {
  driver_id: number;
  driver_name: string;
  total_recharge: number;
  total_expense: number;
  balance: number;
}
