// 报账记录页
import {View, Text, Picker, ScrollView} from '@tarojs/components'
import {useState, useEffect, useCallback} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {withRouteGuard} from '@/components/RouteGuard'
import type {ExpenseRecord, MonthlyStats} from '@/db/types'
import {getExpenseRecordsByMonth, getMonthlyStats, getOvertimeCount, deleteExpenseRecord} from '@/db/api'

function Records() {
  const {driver} = useAuth()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [records, setRecords] = useState<ExpenseRecord[]>([])
  const [stats, setStats] = useState<MonthlyStats>({
    total_expense: 0,
    total_commission: 0,
    overtime_count: 0,
    pending_count: 0,
    confirmed_count: 0
  })
  const [loading, setLoading] = useState(false)

  // 初始化为当月
  useEffect(() => {
    const today = new Date()
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(monthStr)
  }, [])

  const loadData = useCallback(async () => {
    if (!driver || !selectedMonth) return

    setLoading(true)

    const [year, month] = selectedMonth.split('-').map(Number)

    // 加载记录
    const {data: recordsData} = await getExpenseRecordsByMonth(driver.id, year, month)
    setRecords(recordsData)

    // 加载统计
    const {data: statsData} = await getMonthlyStats(driver.id, year, month)
    const {count: overtimeCount} = await getOvertimeCount(driver.id, year, month)

    setStats({
      ...statsData,
      overtime_count: overtimeCount
    })

    setLoading(false)
  }, [driver, selectedMonth])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleMonthChange = (e: any) => {
    setSelectedMonth(e.detail.value)
  }

  const handleRefresh = async () => {
    await loadData()
    Taro.showToast({
      title: '刷新成功',
      icon: 'success'
    })
  }

  const viewDetail = (record: ExpenseRecord) => {
    Taro.navigateTo({
      url: `/pages/record-detail/index?id=${record.id}`
    })
  }

  const editRecord = (record: ExpenseRecord) => {
    Taro.navigateTo({
      url: `/pages/record-edit/index?id=${record.id}`
    })
  }

  const deleteRecord = (record: ExpenseRecord) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除 ${record.plate_number} 的这条报账记录吗？删除后无法恢复。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        const {error} = await deleteExpenseRecord(record.id)
        if (error) {
          Taro.showToast({title: '删除失败，请重试', icon: 'none'})
        } else {
          await loadData()
          Taro.showToast({title: '已删除', icon: 'success'})
        }
      }
    })
  }

  // 按日期分组
  const groupedRecords = records.reduce(
    (groups, record) => {
      const date = record.record_date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(record)
      return groups
    },
    {} as Record<string, ExpenseRecord[]>
  )

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a))

  return (
    <View className="page-shell">
      <ScrollView className="w-full" scrollY onScrollToUpper={handleRefresh}>
        <View className="px-4 py-5">
          <View className="surface-card p-4 mb-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="text-xl font-semibold text-foreground">报账记录</Text>
              <View className="soft-chip px-3 py-1">
                <Text className="text-sm text-muted-foreground">{records.length} 条</Text>
              </View>
            </View>

            <Picker mode="date" fields="month" value={selectedMonth} onChange={handleMonthChange}>
              <View className="rounded-xl border border-border bg-background px-3 py-3 flex flex-row items-center justify-between">
                <Text className="text-base text-muted-foreground">月份</Text>
                <Text className="text-base text-foreground font-medium">{selectedMonth}</Text>
              </View>
            </Picker>
          </View>

          <View className="surface-card p-4 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-3">本月统计</Text>
            <View className="grid grid-cols-2 gap-2">
              <View className="rounded-xl bg-red-50 px-3 py-3">
                <Text className="text-sm text-red-500">支出合计</Text>
                <Text className="text-lg text-red-600 font-semibold">¥{stats.total_expense.toFixed(2)}</Text>
              </View>
              <View className="rounded-xl bg-green-50 px-3 py-3">
                <Text className="text-sm text-green-600">提成合计</Text>
                <Text className="text-lg text-green-700 font-semibold">¥{stats.total_commission.toFixed(2)}</Text>
              </View>
              <View className="rounded-xl bg-blue-50 px-3 py-3">
                <Text className="text-sm text-blue-500">加班次数</Text>
                <Text className="text-lg text-blue-700 font-semibold">{stats.overtime_count} 次</Text>
              </View>
              <View className="rounded-xl bg-amber-50 px-3 py-3">
                <Text className="text-sm text-amber-600">待确认</Text>
                <Text className="text-lg text-amber-700 font-semibold">{stats.pending_count} 条</Text>
              </View>
            </View>
          </View>

          {loading && (
            <View className="surface-card py-10 flex flex-col items-center">
              <View className="i-mdi-loading animate-spin text-primary text-5xl mb-3" />
              <Text className="text-base text-muted-foreground">加载中...</Text>
            </View>
          )}

          {!loading && records.length === 0 && (
            <View className="surface-card py-10 flex flex-col items-center">
              <View className="i-mdi-file-document-outline text-muted-foreground text-5xl mb-3" />
              <Text className="text-base text-muted-foreground">暂无记录</Text>
            </View>
          )}

          {!loading &&
            sortedDates.map((date) => (
              <View key={date} className="mb-4">
                <View className="flex flex-row items-center mb-2">
                  <View className="h-px flex-1 bg-border" />
                  <Text className="px-3 text-sm text-muted-foreground">{date}</Text>
                  <View className="h-px flex-1 bg-border" />
                </View>

                {groupedRecords[date].map((record) => (
                  <View key={record.id} className="surface-card p-4 mb-2" onClick={() => viewDetail(record)}>
                    <View className="flex flex-row items-center justify-between mb-2">
                      <Text className="text-lg font-semibold text-foreground">{record.plate_number}</Text>
                      {record.status === 'pending' ? (
                        <View className="soft-chip bg-amber-100 border-amber-200 px-3 py-1">
                          <Text className="text-sm text-amber-700">待确认</Text>
                        </View>
                      ) : (
                        <View className="soft-chip bg-emerald-100 border-emerald-200 px-3 py-1">
                          <Text className="text-sm text-emerald-700">已确认</Text>
                        </View>
                      )}
                    </View>

                    {record.route && (
                      <Text className="text-sm text-muted-foreground mb-2">路线：{record.route}</Text>
                    )}

                    <View className="flex flex-row flex-wrap gap-2 mb-3">
                      {record.fee_weighing > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">过磅 ¥{record.fee_weighing}</Text>}
                      {record.fee_container > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">提柜 ¥{record.fee_container}</Text>}
                      {record.fee_overnight > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">过夜 ¥{record.fee_overnight}</Text>}
                      {record.fee_vn_overtime > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">越南超时 ¥{record.fee_vn_overtime}</Text>}
                      {record.fee_vn_key > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">收钥匙 ¥{record.fee_vn_key}</Text>}
                      {record.fee_parking > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">停车 ¥{record.fee_parking}</Text>}
                      {record.fee_newpost > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">新岗 ¥{record.fee_newpost}</Text>}
                      {record.fee_taxi > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">打车 ¥{record.fee_taxi}</Text>}
                      {record.fee_water > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">淋水 ¥{record.fee_water}</Text>}
                      {record.fee_tarpaulin > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">解篷布 ¥{record.fee_tarpaulin}</Text>}
                      {record.fee_highway > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">高速 ¥{record.fee_highway}</Text>}
                      {record.fee_stamp > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">盖章 ¥{record.fee_stamp}</Text>}
                      {record.note_amount > 0 && <Text className="soft-chip px-2 py-1 text-xs text-foreground">其他 ¥{record.note_amount}</Text>}
                    </View>

                    <View className="flex flex-row items-center justify-between">
                      <Text className="text-sm text-muted-foreground">小计</Text>
                      <Text className="text-lg font-semibold text-primary">¥{record.total_expense.toFixed(2)}</Text>
                    </View>

                    {record.commission > 0 && (
                      <View className="mt-1 flex flex-row items-center justify-between">
                        <Text className="text-sm text-muted-foreground">提成</Text>
                        <Text className="text-base font-semibold text-green-600">¥{record.commission.toFixed(2)}</Text>
                      </View>
                    )}

                    {record.status === 'pending' && (
                      <View className="mt-3 flex flex-row gap-2">
                        <View
                          className="flex-1 rounded-xl bg-primary py-2 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            editRecord(record)
                          }}>
                          <Text className="text-base text-primary-foreground">编辑</Text>
                        </View>
                        <View
                          className="flex-1 rounded-xl bg-destructive py-2 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteRecord(record)
                          }}>
                          <Text className="text-base text-white">删除</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  )
}

export default withRouteGuard(Records)
