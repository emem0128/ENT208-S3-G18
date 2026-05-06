// 数据库查询 API 封装
import {supabase} from '@/client/supabase'
import type {
  AdvanceFundRecord,
  Driver,
  ExpenseRecord,
  FeeType,
  FundStats,
  MonthlyStats,
  OtherFeeItem,
  Vehicle
} from './types'

export type {Driver}

let activeVehiclesCache: Vehicle[] | null = null

function normalizePlateNumber(value: string) {
  return value.replace(/\s+/g, '').trim().toUpperCase()
}

function buildExpenseRecordPayload(record: Partial<ExpenseRecord>): Partial<ExpenseRecord> {
  return {
    driver_id: record.driver_id,
    record_date: record.record_date,
    plate_number: record.plate_number,
    route: record.route,
    fee_weighing: record.fee_weighing,
    fee_container: record.fee_container,
    fee_overnight: record.fee_overnight,
    fee_vn_overtime: record.fee_vn_overtime,
    fee_vn_key: record.fee_vn_key,
    fee_parking: record.fee_parking,
    fee_newpost: record.fee_newpost,
    fee_taxi: record.fee_taxi,
    fee_water: record.fee_water,
    fee_tarpaulin: record.fee_tarpaulin,
    fee_highway: record.fee_highway,
    fee_stamp: record.fee_stamp,
    fee_location_detail: record.fee_location_detail,
    note_amount: record.note_amount,
    note_detail: record.note_detail,
    total_expense: record.total_expense,
    commission: record.commission,
    receipt_images: record.receipt_images,
    status: record.status,
    confirmed_by: record.confirmed_by,
    confirmed_at: record.confirmed_at,
    is_overtime: record.is_overtime
  }
}

function normalizeOtherFees(otherFees?: OtherFeeItem[] | null) {
  return (otherFees || [])
    .map((item, index) => ({
      name: item.name?.trim() || '',
      amount: Number(item.amount) || 0,
      sort_order: item.sort_order ?? index
    }))
    .filter((item) => item.name && item.amount > 0)
}

async function replaceExpenseOtherFees(expenseRecordId: number, otherFees?: OtherFeeItem[] | null) {
  const {error: deleteError} = await supabase
    .from('expense_other_fees')
    .delete()
    .eq('expense_record_id', expenseRecordId)

  if (deleteError) {
    console.error('清理其他费用明细失败:', deleteError)
    return {error: deleteError}
  }

  const normalized = normalizeOtherFees(otherFees)
  if (normalized.length === 0) {
    return {error: null}
  }

  const payload = normalized.map((item) => ({
    expense_record_id: expenseRecordId,
    name: item.name,
    amount: item.amount,
    sort_order: item.sort_order
  }))

  const {error: insertError} = await supabase.from('expense_other_fees').insert(payload)

  if (insertError) {
    console.error('写入其他费用明细失败:', insertError)
    return {error: insertError}
  }

  return {error: null}
}

// ==================== 司机相关 ====================

/**
 * 根据用户名和密码验证司机登录
 */
export async function verifyDriverLogin(username: string, password: string) {
  const {data, error} = await supabase
    .from('drivers')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('验证司机登录失败:', error)
    return {data: null, error}
  }

  return {data: data as Driver | null, error: null}
}

/**
 * 根据ID获取司机信息
 */
export async function getDriverById(driverId: number) {
  const {data, error} = await supabase.from('drivers').select('*').eq('id', driverId).maybeSingle()

  if (error) {
    console.error('获取司机信息失败:', error)
    return {data: null, error}
  }

  return {data: data as Driver | null, error: null}
}

// ==================== 车辆相关 ====================

async function getActiveVehicles() {
  if (activeVehiclesCache) {
    return {data: activeVehiclesCache, error: null}
  }

  const {data, error} = await supabase
    .from('vehicles')
    .select('id, plate_number, vehicle_type, source, is_active, created_at')
    .eq('is_active', true)
    .order('plate_number')
    .limit(200)

  if (error) {
    console.error('获取车辆列表失败:', error)
    return {data: [], error}
  }

  activeVehiclesCache = Array.isArray(data) ? (data as Vehicle[]) : []
  return {data: activeVehiclesCache, error: null}
}

/**
 * 搜索车牌号（模糊匹配）
 */
export async function searchVehicles(keyword: string) {
  const normalizedKeyword = normalizePlateNumber(keyword)

  if (!normalizedKeyword) {
    return {data: [], error: null}
  }

  const {data, error} = await getActiveVehicles()

  if (error) {
    console.error('搜索车辆失败:', error)
    return {data: [], error}
  }

  const matchedVehicles = data
    .filter((vehicle) => normalizePlateNumber(vehicle.plate_number).includes(normalizedKeyword))
    .sort((a, b) => {
      const aPlate = normalizePlateNumber(a.plate_number)
      const bPlate = normalizePlateNumber(b.plate_number)
      const aStartsWith = aPlate.startsWith(normalizedKeyword) ? 0 : 1
      const bStartsWith = bPlate.startsWith(normalizedKeyword) ? 0 : 1

      if (aStartsWith !== bStartsWith) {
        return aStartsWith - bStartsWith
      }

      return aPlate.localeCompare(bPlate)
    })
    .slice(0, 10)

  return {data: matchedVehicles, error: null}
}

/**
 * 检查车牌号是否在库中
 */
export async function checkVehicleExists(plateNumber: string) {
  const normalizedPlateNumber = normalizePlateNumber(plateNumber)

  if (!normalizedPlateNumber) {
    return {exists: false, error: null}
  }

  const {data, error} = await getActiveVehicles()

  if (error) {
    console.error('检查车牌失败:', error)
    return {exists: false, error}
  }

  const exists = data.some((vehicle) => normalizePlateNumber(vehicle.plate_number) === normalizedPlateNumber)

  return {exists, error: null}
}

// ==================== 费用类型相关 ====================

/**
 * 获取所有启用的费用类型
 */
export async function getFeeTypes() {
  const {data, error} = await supabase
    .from('fee_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('获取费用类型失败:', error)
    return {data: [], error}
  }

  return {data: Array.isArray(data) ? (data as FeeType[]) : [], error: null}
}

// ==================== 报账记录相关 ====================

/**
 * 创建报账记录
 */
export async function createExpenseRecord(record: Partial<ExpenseRecord>) {
  const payload = buildExpenseRecordPayload(record)
  const {data, error} = await supabase.from('expense_records').insert(payload).select().maybeSingle()

  if (error) {
    console.error('创建报账记录失败:', error)
    return {data: null, error}
  }

  const createdRecord = data as ExpenseRecord | null
  if (createdRecord?.id && record.other_fees?.length) {
    const childResult = await replaceExpenseOtherFees(createdRecord.id, record.other_fees)
    if (childResult.error) {
      return {data: createdRecord, error: childResult.error}
    }
  }

  return {
    data: createdRecord
      ? {
          ...createdRecord,
          other_fees: normalizeOtherFees(record.other_fees)
        }
      : null,
    error: null
  }
}

/**
 * 批量创建报账记录
 */
export async function createExpenseRecords(records: Partial<ExpenseRecord>[]) {
  const payload = records.map(buildExpenseRecordPayload)
  const {data, error} = await supabase.from('expense_records').insert(payload).select()

  if (error) {
    console.error('批量创建报账记录失败:', error)
    return {data: [], error}
  }

  const createdRecords = Array.isArray(data) ? (data as ExpenseRecord[]) : []

  for (let index = 0; index < createdRecords.length; index++) {
    const createdRecord = createdRecords[index]
    const sourceRecord = records[index]
    if (!createdRecord?.id || !sourceRecord?.other_fees?.length) continue

    const childResult = await replaceExpenseOtherFees(createdRecord.id, sourceRecord.other_fees)
    if (childResult.error) {
      return {data: createdRecords, error: childResult.error}
    }
  }

  return {
    data: createdRecords.map((record, index) => ({
      ...record,
      other_fees: normalizeOtherFees(records[index]?.other_fees)
    })),
    error: null
  }
}

/**
 * 更新报账记录
 */
export async function updateExpenseRecord(id: number, updates: Partial<ExpenseRecord>) {
  const payload = buildExpenseRecordPayload(updates)
  const {data, error} = await supabase
    .from('expense_records')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('更新报账记录失败:', error)
    return {data: null, error}
  }

  const childResult = await replaceExpenseOtherFees(id, updates.other_fees)
  if (childResult.error) {
    return {data: data as ExpenseRecord | null, error: childResult.error}
  }

  return {
    data: data
      ? {
          ...(data as ExpenseRecord),
          other_fees: normalizeOtherFees(updates.other_fees)
        }
      : null,
    error: null
  }
}

export async function fetchOtherFees(recordId: number) {
  const {data, error} = await supabase
    .from('expense_other_fees')
    .select('*')
    .eq('expense_record_id', recordId)
    .order('sort_order', {ascending: true})
    .order('id', {ascending: true})

  if (error) {
    console.error('获取其他费用明细失败:', error)
    return {data: [], error}
  }

  return {data: Array.isArray(data) ? (data as OtherFeeItem[]) : [], error: null}
}

/**
 * 删除报账记录（仅限 pending 状态）
 */
export async function deleteExpenseRecord(id: number) {
  const {data, error} = await supabase
    .from('expense_records')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    console.error('删除报账记录失败:', error)
    return {error}
  }

  if (!data || data.length === 0) {
    const deleteError = new Error('未找到可删除的报账记录')
    console.error('删除报账记录失败:', deleteError)
    return {error: deleteError}
  }

  return {error: null}
}

/**
 * 获取司机的报账记录（按月）
 */
export async function getExpenseRecordsByMonth(driverId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const {data, error} = await supabase
    .from('expense_records')
    .select('*')
    .eq('driver_id', driverId)
    .gte('record_date', startDate)
    .lt('record_date', endDate)
    .order('record_date', {ascending: false})
    .order('created_at', {ascending: false})

  if (error) {
    console.error('获取报账记录失败:', error)
    return {data: [], error}
  }

  return {data: Array.isArray(data) ? (data as ExpenseRecord[]) : [], error: null}
}

/**
 * 获取单条报账记录详情
 */
export async function getExpenseRecordById(id: number) {
  const {data, error} = await supabase.from('expense_records').select('*').eq('id', id).maybeSingle()

  if (error) {
    console.error('获取报账记录详情失败:', error)
    return {data: null, error}
  }

  const record = data as ExpenseRecord | null
  if (!record) {
    return {data: null, error: null}
  }

  const otherFeesRes = await fetchOtherFees(id)
  if (otherFeesRes.error) {
    return {data: record, error: otherFeesRes.error}
  }

  return {
    data: {
      ...record,
      other_fees: otherFeesRes.data
    },
    error: null
  }
}

/**
 * 获取司机某月的统计数据
 */
export async function getMonthlyStats(driverId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const {data, error} = await supabase
    .from('expense_records')
    .select('total_expense, commission, status, is_overtime, record_date')
    .eq('driver_id', driverId)
    .gte('record_date', startDate)
    .lt('record_date', endDate)

  if (error) {
    console.error('获取月度统计失败:', error)
    return {
      data: {
        total_expense: 0,
        total_commission: 0,
        overtime_count: 0,
        pending_count: 0,
        confirmed_count: 0
      } as MonthlyStats,
      error
    }
  }

  const records = Array.isArray(data) ? data : []
  
  // 统计加班天数：按日期去重
  const overtimeDates = new Set<string>()
  records.forEach((r) => {
    if (r.status === 'confirmed' && r.is_overtime) {
      overtimeDates.add(r.record_date)
    }
  })

  const stats: MonthlyStats = {
    total_expense: records.reduce((sum, r) => sum + Number(r.total_expense || 0), 0),
    total_commission: records.reduce((sum, r) => sum + Number(r.commission || 0), 0),
    overtime_count: overtimeDates.size,
    pending_count: records.filter((r) => r.status === 'pending').length,
    confirmed_count: records.filter((r) => r.status === 'confirmed').length
  }

  return {data: stats, error: null}
}

// ==================== 加班记录相关 ====================

/**
 * 获取司机某月的加班次数（按日期去重，仅统计已确认的记录）
 */
export async function getOvertimeCount(driverId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const {data, error} = await supabase
    .from('expense_records')
    .select('record_date')
    .eq('driver_id', driverId)
    .eq('status', 'confirmed')
    .eq('is_overtime', true)
    .gte('record_date', startDate)
    .lt('record_date', endDate)

  if (error) {
    console.error('获取加班次数失败:', error)
    return {count: 0, error}
  }

  // 按日期去重
  const uniqueDates = new Set<string>()
  if (Array.isArray(data)) {
    data.forEach((record) => {
      uniqueDates.add(record.record_date)
    })
  }

  return {count: uniqueDates.size, error: null}
}

// ==================== 备用金相关 ====================

/**
 * 获取司机某月的备用金统计
 */
export async function getFundStats(driverId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // 获取充值记录
  const {data: fundData, error: fundError} = await supabase
    .from('advance_fund_records')
    .select('*')
    .eq('driver_id', driverId)
    .gte('fund_date', startDate)
    .lt('fund_date', endDate)
    .order('fund_date')

  if (fundError) {
    console.error('获取备用金记录失败:', fundError)
  }

  // 获取已确认的支出记录
  const {data: expenseData, error: expenseError} = await supabase
    .from('expense_records')
    .select('record_date, total_expense')
    .eq('driver_id', driverId)
    .eq('status', 'confirmed')
    .gte('record_date', startDate)
    .lt('record_date', endDate)
    .order('record_date')

  if (expenseError) {
    console.error('获取支出记录失败:', expenseError)
  }

  const fundRecords = Array.isArray(fundData) ? (fundData as AdvanceFundRecord[]) : []
  const expenseRecords = Array.isArray(expenseData) ? expenseData : []

  const totalRecharge = fundRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  const totalExpense = expenseRecords.reduce((sum, r) => sum + Number(r.total_expense || 0), 0)

  const records: FundStats['records'] = [
    ...fundRecords.map((r) => ({
      date: r.fund_date,
      type: 'recharge' as const,
      amount: Number(r.amount),
      description: r.note || '充值'
    })),
    ...expenseRecords.map((r) => ({
      date: r.record_date,
      type: 'expense' as const,
      amount: Number(r.total_expense),
      description: '支出'
    }))
  ].sort((a, b) => a.date.localeCompare(b.date))

  const stats: FundStats = {
    total_recharge: totalRecharge,
    total_expense: totalExpense,
    balance: totalRecharge - totalExpense,
    records
  }

  return {data: stats, error: null}
}
