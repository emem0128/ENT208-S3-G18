import { supabase } from '@/lib/supabase';
import { endOfMonth, parse, format } from 'date-fns';
import type {
  ServiceStaff,
  Driver,
  Vehicle,
  FeeType,
  ExpenseRecord,
  AdvanceFundRecord,
  OperationLog,
  ExpenseRecordWithDriver,
  AdvanceFundRecordWithDriver,
} from '@/types/database';

const QUERY_CACHE_TTL_MS = 30_000;
const queryCache = new Map<string, { expiresAt: number; data: unknown }>();

function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    queryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T) {
  queryCache.set(key, {
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
    data,
  });
}

function invalidateCache(prefix: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

// 辅助函数：获取月末日期
function getMonthEndDate(month: string): string {
  return format(endOfMonth(parse(`${month}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
}

// ==================== 客服人员 ====================

export async function loginServiceStaff(username: string, password: string) {
  const { data, error } = await supabase
    .from('service_staff')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllServiceStaff() {
  const cacheKey = 'service_staff:all';
  const cached = getCached<ServiceStaff[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('service_staff')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const result = Array.isArray(data) ? data : [];
  setCached(cacheKey, result);
  return result;
}

export async function createServiceStaff(staff: Omit<ServiceStaff, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('service_staff')
    .insert(staff)
    .select()
    .single();

  if (error) throw error;
  invalidateCache('service_staff:');
  return data;
}

export async function updateServiceStaff(id: number, updates: Partial<ServiceStaff>) {
  const { error } = await supabase
    .from('service_staff')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  invalidateCache('service_staff:');
}

export async function deleteServiceStaff(id: number) {
  const { error } = await supabase
    .from('service_staff')
    .delete()
    .eq('id', id);

  if (error) throw error;
  invalidateCache('service_staff:');
}

// ==================== 司机 ====================

export async function getAllDrivers(activeOnly = false) {
  const cacheKey = `drivers:${activeOnly ? 'active' : 'all'}`;
  const cached = getCached<Driver[]>(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  const result = Array.isArray(data) ? data : [];
  setCached(cacheKey, result);
  return result;
}

export async function getDriverById(id: number) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createDriver(driver: Omit<Driver, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single();

  if (error) throw error;
  invalidateCache('drivers:');
  return data;
}

export async function updateDriver(id: number, updates: Partial<Driver>) {
  const { error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  invalidateCache('drivers:');
}

// ==================== 车辆 ====================

export async function getAllVehicles(activeOnly = false) {
  const cacheKey = `vehicles:${activeOnly ? 'active' : 'all'}`;
  const cached = getCached<Vehicle[]>(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  const result = Array.isArray(data) ? data : [];
  setCached(cacheKey, result);
  return result;
}

export async function createVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicle)
    .select()
    .single();

  if (error) throw error;
  invalidateCache('vehicles:');
  return data;
}

export async function updateVehicle(id: number, updates: Partial<Vehicle>) {
  const { error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  invalidateCache('vehicles:');
}

// ==================== 费用类型 ====================

export async function getAllFeeTypes(activeOnly = false) {
  const cacheKey = `fee_types:${activeOnly ? 'active' : 'all'}`;
  const cached = getCached<FeeType[]>(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from('fee_types')
    .select('*')
    .order('sort_order', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  const result = Array.isArray(data) ? data : [];
  setCached(cacheKey, result);
  return result;
}

export async function createFeeType(feeType: Omit<FeeType, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('fee_types')
    .insert(feeType)
    .select()
    .single();

  if (error) throw error;
  invalidateCache('fee_types:');
  return data;
}

export async function updateFeeType(id: number, updates: Partial<FeeType>) {
  const { error } = await supabase
    .from('fee_types')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  invalidateCache('fee_types:');
}

// ==================== 报账记录 ====================

export async function getExpenseRecords(filters?: {
  driverId?: number;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'confirmed';
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('expense_records')
    .select('*, driver:drivers!expense_records_driver_id_fkey(*)')
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }

  if (filters?.startDate) {
    query = query.gte('record_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('record_date', filters.endDate);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getExpenseRecordById(id: number) {
  const { data, error } = await supabase
    .from('expense_records')
    .select('*, driver:drivers!expense_records_driver_id_fkey(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateExpenseRecord(id: number, updates: Partial<ExpenseRecord>) {
  const { error } = await supabase
    .from('expense_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function confirmExpenseRecord(id: number, confirmedBy: string) {
  const { error } = await supabase
    .from('expense_records')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function batchConfirmExpenseRecords(ids: number[], confirmedBy: string) {
  const { error } = await supabase
    .from('expense_records')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;
}

export async function batchUpdateCommission(ids: number[], commission: number) {
  const { error } = await supabase
    .from('expense_records')
    .update({
      commission,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;
}

// ==================== 备用金记录 ====================

export async function getAdvanceFundRecords(filters?: {
  driverId?: number;
  month?: string;
}) {
  let query = supabase
    .from('advance_fund_records')
    .select('*, driver:drivers!advance_fund_records_driver_id_fkey(*)')
    .order('fund_date', { ascending: false });

  if (filters?.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }

  if (filters?.month) {
    query = query.eq('month', filters.month);
  }

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createAdvanceFundRecord(record: Omit<AdvanceFundRecord, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('advance_fund_records')
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAdvanceFundRecord(id: number, updates: Partial<AdvanceFundRecord>) {
  const { error } = await supabase
    .from('advance_fund_records')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAdvanceFundRecord(id: number) {
  const { error } = await supabase
    .from('advance_fund_records')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==================== 操作日志 ====================

export async function createOperationLog(log: Omit<OperationLog, 'id' | 'created_at'>) {
  const { error } = await supabase
    .from('operation_logs')
    .insert(log);

  if (error) throw error;
}

export async function getOperationLogs(filters?: {
  operatorId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('operation_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.operatorId) {
    query = query.eq('operator_id', filters.operatorId);
  }

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ==================== 统计查询 ====================

export async function getDashboardStats(date: string, month: string) {
  const monthEndDate = getMonthEndDate(month);
  const [todayNewRes, todayPendingRes, todayConfirmedRes, totalPendingRes, monthRecordsRes] =
    await Promise.all([
      supabase
        .from('expense_records')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`),
      supabase
        .from('expense_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('record_date', date),
      supabase
        .from('expense_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('confirmed_at', `${date}T00:00:00`)
        .lte('confirmed_at', `${date}T23:59:59`),
      supabase
        .from('expense_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('expense_records')
        .select('total_expense, commission, is_overtime, record_date')
        .eq('status', 'confirmed')
        .gte('record_date', `${month}-01`)
        .lte('record_date', monthEndDate)
    ]);

  if (todayNewRes.error) throw todayNewRes.error;
  if (todayPendingRes.error) throw todayPendingRes.error;
  if (todayConfirmedRes.error) throw todayConfirmedRes.error;
  if (totalPendingRes.error) throw totalPendingRes.error;
  if (monthRecordsRes.error) throw monthRecordsRes.error;

  const todayNew = todayNewRes.count || 0;
  const todayPending = todayPendingRes.count || 0;
  const todayConfirmed = todayConfirmedRes.count || 0;
  const totalPending = totalPendingRes.count || 0;
  const monthRecords = monthRecordsRes.data || [];

  const monthTotalExpense = monthRecords?.reduce((sum, r) => sum + Number(r.total_expense), 0) || 0;
  const monthTotalCommission = monthRecords?.reduce((sum, r) => sum + Number(r.commission), 0) || 0;
  const monthRecordCount = monthRecords?.length || 0;

  // 本月加班天数（去重）
  const overtimeDates = new Set(
    monthRecords?.filter(r => r.is_overtime).map(r => r.record_date) || []
  );
  const monthOvertimeDays = overtimeDates.size;

  return {
    todayNew: todayNew || 0,
    todayPending: todayPending || 0,
    todayConfirmed: todayConfirmed || 0,
    totalPending: totalPending || 0,
    monthTotalExpense,
    monthTotalCommission,
    monthRecordCount,
    monthOvertimeDays,
  };
}

export async function getDriverMonthStats(month: string) {
  const monthEnd = getMonthEndDate(month);
  
  // 批量查询所需最小字段，减少网络传输
  const [drivers, { data: allExpenseRecords }, { data: allFundRecords }] = await Promise.all([
    getAllDrivers(true),
    supabase
      .from('expense_records')
      .select('driver_id, status, total_expense, commission, is_overtime, record_date')
      .gte('record_date', `${month}-01`)
      .lte('record_date', monthEnd),
    supabase
      .from('advance_fund_records')
      .select('driver_id, amount')
      .eq('month', month)
  ]);

  const expenseRecords = allExpenseRecords || [];
  const fundRecords = allFundRecords || [];

  // 线性聚合，避免在 map 内反复 filter 导致性能下降
  const expenseByDriver = new Map<number, {
    recordCount: number;
    pendingCount: number;
    confirmedCount: number;
    totalExpense: number;
    totalCommission: number;
    overtimeDates: Set<string>;
  }>();
  const rechargeByDriver = new Map<number, number>();

  expenseRecords.forEach((r) => {
    const driverId = Number(r.driver_id);
    if (!expenseByDriver.has(driverId)) {
      expenseByDriver.set(driverId, {
        recordCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        totalExpense: 0,
        totalCommission: 0,
        overtimeDates: new Set<string>(),
      });
    }

    const agg = expenseByDriver.get(driverId)!;
    agg.recordCount += 1;

    if (r.status === 'pending') {
      agg.pendingCount += 1;
    } else if (r.status === 'confirmed') {
      agg.confirmedCount += 1;
      agg.totalExpense += Number(r.total_expense || 0);
      agg.totalCommission += Number(r.commission || 0);
      if (r.is_overtime && r.record_date) {
        agg.overtimeDates.add(r.record_date);
      }
    }
  });

  fundRecords.forEach((r) => {
    const driverId = Number(r.driver_id);
    const amount = Number(r.amount || 0);
    rechargeByDriver.set(driverId, (rechargeByDriver.get(driverId) || 0) + amount);
  });

  const stats = drivers.map(driver => {
    const agg = expenseByDriver.get(driver.id);
    const totalRecharge = rechargeByDriver.get(driver.id) || 0;
    const totalExpense = agg?.totalExpense || 0;

    return {
      driver_id: driver.id,
      driver_name: driver.name,
      record_count: agg?.recordCount || 0,
      total_expense: totalExpense,
      total_commission: agg?.totalCommission || 0,
      pending_count: agg?.pendingCount || 0,
      confirmed_count: agg?.confirmedCount || 0,
      overtime_days: agg?.overtimeDates.size || 0,
      advance_fund_balance: totalRecharge - totalExpense,
    };
  });

  return stats;
}

export async function getAdvanceFundStats(month: string) {
  const monthEnd = getMonthEndDate(month);

  // 批量查询所有数据
  const [drivers, { data: allFundRecords }, { data: allExpenseRecords }] = await Promise.all([
    getAllDrivers(true),
    supabase
      .from('advance_fund_records')
      .select('*')
      .eq('month', month),
    supabase
      .from('expense_records')
      .select('driver_id, total_expense')
      .eq('status', 'confirmed')
      .gte('record_date', `${month}-01`)
      .lte('record_date', monthEnd)
  ]);

  const fundRecords = allFundRecords || [];
  const expenseRecords = allExpenseRecords || [];

  // 在内存中按司机分组计算
  const stats = drivers.map(driver => {
    const driverFundRecords = fundRecords.filter(r => r.driver_id === driver.id);
    const totalRecharge = driverFundRecords.reduce((sum, r) => sum + Number(r.amount), 0);

    const driverExpenseRecords = expenseRecords.filter(r => r.driver_id === driver.id);
    const totalExpense = driverExpenseRecords.reduce((sum, r) => sum + Number(r.total_expense), 0);

    return {
      driver_id: driver.id,
      driver_name: driver.name,
      total_recharge: totalRecharge,
      total_expense: totalExpense,
      balance: totalRecharge - totalExpense,
    };
  });

  return stats;
}
