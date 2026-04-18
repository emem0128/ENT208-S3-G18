// 数据库表类型定义

export interface Driver {
  id: number
  name: string
  username: string
  password: string
  is_active: boolean
  created_at: string
}

export interface Vehicle {
  id: number
  plate_number: string
  vehicle_type: 'own' | 'affiliated' | 'rented'
  source: string | null
  is_active: boolean
  created_at: string
}

export interface ExpenseRecord {
  id: number
  driver_id: number
  record_date: string
  plate_number: string
  route: string | null
  fee_weighing: number
  fee_container: number
  fee_overnight: number
  fee_vn_overtime: number
  fee_vn_key: number
  fee_parking: number
  fee_newpost: number
  fee_taxi: number
  fee_water: number
  fee_tarpaulin: number
  fee_highway: number
  fee_stamp: number
  note_amount: number
  note_detail: string | null
  total_expense: number
  commission: number
  receipt_images: string[] | null
  status: 'pending' | 'confirmed'
  confirmed_by: string | null
  confirmed_at: string | null
  is_overtime: boolean
  created_at: string
  updated_at: string
}

export interface ServiceStaff {
  id: number
  username: string
  password: string
  name: string
  role: 'admin' | 'staff'
  created_at: string
}

export interface AdvanceFundRecord {
  id: number
  driver_id: number
  amount: number
  fund_date: string
  month: string
  note: string | null
  created_at: string
}

export interface FeeType {
  id: number
  field_name: string
  display_name: string
  sort_order: number
  is_active: boolean
}

// 费用明细项（用于前端表单）
export interface FeeItem {
  id: string // 前端临时ID
  field_name: string
  display_name: string
  amount: number
  note?: string // 仅当 field_name 为 'other' 时使用
}

// 车辆卡片数据（用于前端表单）
export interface VehicleCard {
  id: string // 前端临时ID
  plate_number: string
  route: string
  fee_items: FeeItem[]
  receipt_images: UploadFileInput[]
  note: string
  total: number
}

// 图片上传输入
export interface UploadFileInput {
  path: string
  size: number
  name?: string
  originalFileObj?: File
}

// 报账提交表单数据
export interface ExpenseSubmitData {
  driver_id: number
  record_date: string
  is_overtime: boolean
  vehicles: VehicleCard[]
}

// 月度统计数据
export interface MonthlyStats {
  total_expense: number
  total_commission: number
  overtime_count: number
  pending_count: number
  confirmed_count: number
}

// 备用金统计数据
export interface FundStats {
  total_recharge: number
  total_expense: number
  balance: number
  records: Array<{
    date: string
    type: 'recharge' | 'expense'
    amount: number
    description: string
  }>
}
