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
    <View className="min-h-screen bg-gradient-subtle">
      <ScrollView className="w-full" scrollY>
        <View className="px-4 py-6">
          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <View className="flex flex-col items-center space-y-3">
              <View className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
                <View className="i-mdi-account text-primary text-6xl" />
              </View>
              <Text className="text-3xl font-bold text-foreground">{driver?.name}</Text>
              <View className="bg-muted px-4 py-2 rounded-xl">
                <Text className="text-xl text-muted-foreground">账号：{driver?.username}</Text>
              </View>
            </View>
          </View>

          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <View className="flex flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-semibold text-foreground">备用金信息</Text>
              <Picker mode="date" fields="month" value={selectedMonth} onChange={handleMonthChange}>
                <View className="bg-primary/10 px-4 py-2 rounded-xl">
                  <Text className="text-xl text-primary font-medium">{selectedMonth}</Text>
                </View>
              </Picker>
            </View>

            <View className="flex flex-col space-y-3 mb-4">
              {fundStats.records.map((record, index) => (
                <View key={index} className="flex flex-row items-center justify-between py-2">
                  <View className="flex flex-row items-center space-x-3">
                    <Text className="text-lg text-muted-foreground">{record.date}</Text>
                    <View
                      className={`px-3 py-1 rounded-lg ${
                        record.type === 'recharge' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                      <Text
                        className={`text-lg font-medium ${
                          record.type === 'recharge' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {record.description}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={`text-xl font-semibold ${
                      record.type === 'recharge' ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {record.type === 'recharge' ? '+' : '-'}¥{record.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View className="h-px bg-border my-4" />

            <View className="flex flex-col space-y-3">
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">充值合计</Text>
                <Text className="text-2xl font-bold text-green-600">
                  ¥{fundStats.total_recharge.toFixed(2)}
                </Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">本月支出（已确认）</Text>
                <Text className="text-2xl font-bold text-red-600">
                  ¥{fundStats.total_expense.toFixed(2)}
                </Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-2xl text-foreground font-semibold">余额</Text>
                <Text className="text-3xl font-bold text-primary">
                  ¥{fundStats.balance.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <Text className="text-2xl font-semibold text-foreground mb-4">加班统计</Text>
            <View className="flex flex-col space-y-3">
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">本月加班</Text>
                <Text className="text-2xl font-bold text-primary">{overtimeCount} 次</Text>
              </View>
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">加班费（30元/次）</Text>
                <Text className="text-2xl font-bold text-green-600">
                  ¥{(overtimeCount * 30).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <Button
            className="w-full bg-destructive text-destructive-foreground text-2xl font-semibold rounded-2xl"
            onClick={handleLogout}>
            <View className="py-4">
              <Text>退出登录</Text>
            </View>
          </Button>

          <View className="mt-8">
            <Text className="text-center text-xl text-muted-foreground">© 2026 司机报账系统</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default withRouteGuard(Profile)
