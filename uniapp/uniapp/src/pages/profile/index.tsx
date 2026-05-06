// 我的页面
import {View, Text, Picker, Button, ScrollView} from '@tarojs/components'
import {useState, useEffect, useCallback} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {withRouteGuard} from '@/components/RouteGuard'
import type {FundStats} from '@/db/types'
import {getFundStats, getOvertimeCount} from '@/db/api'

function Profile() {
  const {driver, signOut} = useAuth()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [fundStats, setFundStats] = useState<FundStats>({
    total_recharge: 0,
    total_expense: 0,
    balance: 0,
    records: []
  })
  const [overtimeCount, setOvertimeCount] = useState(0)

  // 初始化为当月
  useEffect(() => {
    const today = new Date()
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(monthStr)
  }, [])

  const loadData = useCallback(async () => {
    if (!driver || !selectedMonth) return

    const [year, month] = selectedMonth.split('-').map(Number)

    const {data: stats} = await getFundStats(driver.id, year, month)
    setFundStats(stats)

    const {count} = await getOvertimeCount(driver.id, year, month)
    setOvertimeCount(count)
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

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          await signOut()
          Taro.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          setTimeout(() => {
            Taro.reLaunch({url: '/pages/login/index'})
          }, 1000)
        }
      }
    })
  }

  return (
    <View className="page-shell">
      <ScrollView className="w-full" scrollY>
        <View className="px-4 py-5">
          <View className="surface-card p-4 mb-4">
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3">
                <View className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center">
                  <View className="i-mdi-account text-primary text-3xl" />
                </View>
                <View>
                  <Text className="text-lg font-semibold text-foreground block">{driver?.name}</Text>
                  <Text className="text-sm text-muted-foreground">账号：{driver?.username}</Text>
                </View>
              </View>
              <View className="soft-chip px-3 py-1">
                <Text className="text-xs text-muted-foreground">司机端</Text>
              </View>
            </View>
          </View>

          <View className="surface-card p-4 mb-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">备用金信息</Text>
              <Picker mode="date" fields="month" value={selectedMonth} onChange={handleMonthChange}>
                <View className="soft-chip px-3 py-1">
                  <Text className="text-sm text-primary">{selectedMonth}</Text>
                </View>
              </Picker>
            </View>

            <View className="grid grid-cols-2 gap-2 mb-3">
              <View className="rounded-xl bg-green-50 px-3 py-3">
                <Text className="text-sm text-green-600">充值合计</Text>
                <Text className="text-lg text-green-700 font-semibold">¥{fundStats.total_recharge.toFixed(2)}</Text>
              </View>
              <View className="rounded-xl bg-red-50 px-3 py-3">
                <Text className="text-sm text-red-500">本月支出</Text>
                <Text className="text-lg text-red-600 font-semibold">¥{fundStats.total_expense.toFixed(2)}</Text>
              </View>
            </View>

            <View className="rounded-xl bg-primary/10 px-3 py-3 mb-3 flex flex-row items-center justify-between">
              <Text className="text-sm text-foreground">当前余额</Text>
              <Text className="text-xl font-bold text-primary">¥{fundStats.balance.toFixed(2)}</Text>
            </View>

            <View className="max-h-72 overflow-hidden rounded-xl border border-border bg-background">
              <ScrollView scrollY className="max-h-72">
                {fundStats.records.length === 0 && (
                  <View className="px-3 py-5 text-center">
                    <Text className="text-sm text-muted-foreground">本月暂无流水</Text>
                  </View>
                )}
                {fundStats.records.map((record, index) => (
                  <View key={index} className="px-3 py-3 border-b border-border last:border-b-0">
                    <View className="flex flex-row items-center justify-between">
                      <View>
                        <Text className="text-sm text-foreground block">{record.description}</Text>
                        <Text className="text-xs text-muted-foreground">{record.date}</Text>
                      </View>
                      <Text className={`text-base font-semibold ${record.type === 'recharge' ? 'text-green-600' : 'text-red-600'}`}>
                        {record.type === 'recharge' ? '+' : '-'}¥{record.amount.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>

          <View className="surface-card p-4 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-3">加班统计</Text>
            <View className="grid grid-cols-2 gap-2">
              <View className="rounded-xl bg-blue-50 px-3 py-3">
                <Text className="text-sm text-blue-600">本月加班</Text>
                <Text className="text-lg text-blue-700 font-semibold">{overtimeCount} 次</Text>
              </View>
              <View className="rounded-xl bg-emerald-50 px-3 py-3">
                <Text className="text-sm text-emerald-600">加班费</Text>
                <Text className="text-lg text-emerald-700 font-semibold">¥{(overtimeCount * 30).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <Button className="w-full bg-destructive text-destructive-foreground rounded-xl" onClick={handleLogout}>
            <View className="py-2">
              <Text className="text-base font-medium">退出登录</Text>
            </View>
          </Button>

          <View className="mt-6 mb-3">
            <Text className="text-center text-xs text-muted-foreground">© 2026 司机报账系统</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default withRouteGuard(Profile)
