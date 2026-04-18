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
          Taro.showToast({title: '已删除', icon: 'success'})
          loadData()
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
    <View className="min-h-screen bg-gradient-subtle">
      <ScrollView className="w-full" scrollY onScrollToUpper={handleRefresh}>
        <View className="px-4 py-6">
          <View className="flex flex-col space-y-2 mb-6">
            <Text className="text-xl text-foreground font-medium">选择月份</Text>
            <Picker mode="date" fields="month" value={selectedMonth} onChange={handleMonthChange}>
              <View className="bg-card rounded-xl border border-border px-4 py-4">
                <Text className="text-foreground text-xl">{selectedMonth}</Text>
              </View>
            </Picker>
          </View>

          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <Text className="text-2xl font-semibold text-foreground mb-4">本月汇总</Text>
            <View className="flex flex-col space-y-3">
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">本月支出合计</Text>
                <Text className="text-2xl font-bold text-destructive">
                  ¥{stats.total_expense.toFixed(2)}
                </Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">本月提成合计</Text>
                <Text className="text-2xl font-bold text-green-600">
                  ¥{stats.total_commission.toFixed(2)}
                </Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">本月加班次数</Text>
                <Text className="text-2xl font-bold text-primary">{stats.overtime_count} 次</Text>
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">待确认</Text>
                <Text className="text-2xl font-bold text-orange-500">{stats.pending_count} 条</Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">已确认</Text>
                <Text className="text-2xl font-bold text-green-600">{stats.confirmed_count} 条</Text>
              </View>
            </View>
          </View>

          {loading && (
            <View className="flex flex-col items-center py-12">
              <View className="i-mdi-loading animate-spin text-primary text-6xl mb-4" />
              <Text className="text-xl text-muted-foreground">加载中...</Text>
            </View>
          )}

          {!loading && records.length === 0 && (
            <View className="flex flex-col items-center py-12">
              <View className="i-mdi-file-document-outline text-muted-foreground text-6xl mb-4" />
              <Text className="text-2xl text-muted-foreground">暂无记录</Text>
            </View>
          )}

          {!loading &&
            sortedDates.map((date) => (
              <View key={date} className="mb-6">
                <View className="flex flex-row items-center mb-3">
                  <View className="h-px flex-1 bg-border" />
                  <Text className="text-xl text-muted-foreground px-4">{date}</Text>
                  <View className="h-px flex-1 bg-border" />
                </View>

                {groupedRecords[date].map((record) => (
                  <View
                    key={record.id}
                    className="bg-card rounded-xl p-5 shadow-elegant mb-3"
                    onClick={() => viewDetail(record)}>
                    <View className="flex flex-col space-y-3">
                      <View className="flex flex-row items-center justify-between">
                        <Text className="text-2xl font-semibold text-foreground">
                          {record.plate_number}
                        </Text>
                        {record.status === 'pending' ? (
                          <View className="bg-orange-100 px-3 py-1 rounded-lg">
                            <Text className="text-lg text-orange-600 font-medium">⏳ 待确认</Text>
                          </View>
                        ) : (
                          <View className="bg-green-100 px-3 py-1 rounded-lg">
                            <Text className="text-lg text-green-600 font-medium">✅ 已确认</Text>
                          </View>
                        )}
                      </View>

                      {record.route && (
                        <View className="flex flex-row items-center">
                          <View className="i-mdi-map-marker text-muted-foreground text-xl mr-2" />
                          <Text className="text-xl text-muted-foreground">{record.route}</Text>
                        </View>
                      )}

                      <View className="flex flex-col space-y-1">
                        <Text className="text-lg text-muted-foreground">费用明细：</Text>
                        <View className="flex flex-row flex-wrap gap-2">
                          {record.fee_weighing > 0 && (
                            <Text className="text-lg text-foreground">过磅费¥{record.fee_weighing}</Text>
                          )}
                          {record.fee_container > 0 && (
                            <Text className="text-lg text-foreground">提柜费¥{record.fee_container}</Text>
                          )}
                          {record.fee_overnight > 0 && (
                            <Text className="text-lg text-foreground">过夜费¥{record.fee_overnight}</Text>
                          )}
                          {record.fee_vn_overtime > 0 && (
                            <Text className="text-lg text-foreground">
                              越南超时费¥{record.fee_vn_overtime}
                            </Text>
                          )}
                          {record.fee_vn_key > 0 && (
                            <Text className="text-lg text-foreground">
                              越南收钥匙¥{record.fee_vn_key}
                            </Text>
                          )}
                          {record.fee_parking > 0 && (
                            <Text className="text-lg text-foreground">停车费¥{record.fee_parking}</Text>
                          )}
                          {record.fee_newpost > 0 && (
                            <Text className="text-lg text-foreground">新岗¥{record.fee_newpost}</Text>
                          )}
                          {record.fee_taxi > 0 && (
                            <Text className="text-lg text-foreground">打车¥{record.fee_taxi}</Text>
                          )}
                          {record.fee_water > 0 && (
                            <Text className="text-lg text-foreground">淋水¥{record.fee_water}</Text>
                          )}
                          {record.fee_tarpaulin > 0 && (
                            <Text className="text-lg text-foreground">解篷布¥{record.fee_tarpaulin}</Text>
                          )}
                          {record.fee_highway > 0 && (
                            <Text className="text-lg text-foreground">高速费¥{record.fee_highway}</Text>
                          )}
                          {record.fee_stamp > 0 && (
                            <Text className="text-lg text-foreground">盖章¥{record.fee_stamp}</Text>
                          )}
                          {record.note_amount > 0 && (
                            <Text className="text-lg text-foreground">其他¥{record.note_amount}</Text>
                          )}
                        </View>
                      </View>

                      <View className="flex flex-row items-center justify-between">
                        <Text className="text-xl text-foreground font-medium">小计</Text>
                        <Text className="text-2xl font-bold text-primary">
                          ¥{record.total_expense.toFixed(2)}
                        </Text>
                      </View>

                      {record.commission > 0 && (
                        <View className="flex flex-row items-center justify-between">
                          <Text className="text-xl text-foreground font-medium">提成</Text>
                          <Text className="text-2xl font-bold text-green-600">
                            ¥{record.commission.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {record.status === 'pending' && (
                        <View className="flex flex-row space-x-3">
                          <View
                            className="flex-1 bg-primary rounded-xl py-3 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation()
                              editRecord(record)
                            }}>
                            <Text className="text-xl text-primary-foreground font-medium">编辑</Text>
                          </View>
                          <View
                            className="flex-1 bg-destructive rounded-xl py-3 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteRecord(record)
                            }}>
                            <Text className="text-xl text-white font-medium">删除</Text>
                          </View>
                        </View>
                      )}
                    </View>
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
