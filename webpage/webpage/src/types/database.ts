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
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  is_active: boolean;
  created_at: string;
}

export type VehicleType = 'own' | 'affiliated' | 'rented';
export type VehicleDataSource = 'verified' | 'legacy' | 'manual';
export type VehicleKind = 'truck' | 'trailer';
export type VehicleDocumentType = 'license_front' | 'license_back' | 'green_book_1' | 'green_book_2' | 'green_book_3';

export interface OperatingCompany {
  id: number;
  name: string;
  short_name?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  vehicle_type: VehicleType;
  source?: string | null;
  terminal_phone?: string | null;
  fleet_name?: string | null;
  group_number?: string | null;
  group_leader?: string | null;
  asset_owner?: string | null;
  vehicle_model_short?: string | null;
  vehicle_category?: string | null;
  operating_company_id?: number | null;
  brand?: string | null;
  model?: string | null;
  vin?: string | null;
  engine_number?: string | null;
  registration_date?: string | null;
  license_issue_date?: string | null;
  archive_number?: string | null;
  approved_passengers?: number | null;
  total_mass_kg?: number | null;
  curb_mass_kg?: number | null;
  load_mass_kg?: number | null;
  traction_mass_kg?: number | null;
  dimensions?: string | null;
  scrap_date?: string | null;
  inspection_expiry?: string | null;
  barcode?: string | null;
  insurance_expiry?: string | null;
  filing_expiry?: string | null;
  data_source?: VehicleDataSource | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface VehicleSortedRow extends Vehicle {
  data_source_rank?: number | null;
  operating_company_short_name?: string | null;
}

export interface VehicleTrailer {
  id: number;
  plate_number: string;
  asset_owner?: string | null;
  vehicle_category?: string | null;
  operating_company_id?: number | null;
  brand?: string | null;
  model?: string | null;
  vin?: string | null;
  registration_date?: string | null;
  license_issue_date?: string | null;
  archive_number?: string | null;
  total_mass_kg?: number | null;
  curb_mass_kg?: number | null;
  load_mass_kg?: number | null;
  dimensions?: string | null;
  scrap_date?: string | null;
  inspection_expiry?: string | null;
  barcode?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  operating_company_short_name?: string | null;
  current_truck_plate?: string | null;
}

export interface VehicleDocument {
  id: number;
  vehicle_kind: VehicleKind;
  vehicle_id: number;
  document_type: VehicleDocumentType;
  image_url: string;
  created_at: string;
  updated_at?: string | null;
}

export interface TruckTrailerAssignment {
  id: number;
  truck_id: number;
  trailer_id: number;
  assigned_from: string;
  assigned_until?: string | null;
  is_current: boolean;
  note?: string | null;
  created_at: string;
  trailer?: VehicleTrailer | null;
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
  fee_location_detail?: string;
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
  other_fees?: OtherFeeItem[];
}

export interface ExpenseFeeDetail {
  id: number;
  expense_record_id: number;
  fee_field_name: string;
  detail_location: string;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OtherFeeItem {
  id?: number;
  expense_record_id?: number;
  name: string;
  amount: number;
  sort_order?: number;
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

export interface LegalReview {
  id: number;
  file_name: string;
  review_result: string;
  risk_level: '高' | '中' | '低' | null;
  created_by?: string | null;
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
