// 报账提交页（首页）
import {Button, Image, Picker, ScrollView, Switch, Text, View} from '@tarojs/components'
import Taro, {useDidShow} from '@tarojs/taro'
import {useCallback, useEffect, useState} from 'react'
import {withRouteGuard} from '@/components/RouteGuard'
import VehicleCardComponent from '@/components/VehicleCard'
import {useAuth} from '@/contexts/AuthContext'
import {createExpenseRecords, getDriverById, getFeeTypes} from '@/db/api'
import type {ExpenseRecord, FeeType, OtherFeeItem, VehicleCard} from '@/db/types'
import {uploadFiles} from '@/utils/upload'

const STORAGE_KEY = 'expense_draft'

function Submit() {
  const {driver} = useAuth()
  const [selectedDate, setSelectedDate] = useState('')
  const [isOvertime, setIsOvertime] = useState(false)
  const [vehicles, setVehicles] = useState<VehicleCard[]>([])
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0)
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 今天日期（用于快捷按钮）
  const todayStr = (() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })()

  // 加载费用类型
  useEffect(() => {
    getFeeTypes().then(({data}) => {
      setFeeTypes(data)
    })
  }, [])

  // 自动暂存
  useEffect(() => {
    if (vehicles.length > 0 || isOvertime) {
      const draft = {
        selectedDate,
        isOvertime,
        vehicles
      }
      Taro.setStorageSync(STORAGE_KEY, draft)
    }
  }, [selectedDate, isOvertime, vehicles])

  // 恢复暂存
  useDidShow(() => {
    // 当前页面已有内容（用户正在操作或刚从相册返回），不弹提示
    if (vehicles.length > 0 || selectedDate) return

    const draft = Taro.getStorageSync(STORAGE_KEY)
    if (!draft || !draft.vehicles) return

    // 检查暂存是否有实质内容（至少一辆车有车牌或费用）
    const hasRealContent = draft.vehicles.some(
      (v: {plate_number?: string; fee_items?: unknown[]}) => v.plate_number?.trim() || (v.fee_items?.length ?? 0) > 0
    )
    if (!hasRealContent) {
      Taro.removeStorageSync(STORAGE_KEY)
      return
    }

    Taro.showModal({
      title: '提示',
      content: '检测到上次未提交的报账记录，是否恢复？',
      success: (res) => {
        if (res.confirm) {
          setSelectedDate(draft.selectedDate || '')
          setIsOvertime(draft.isOvertime || false)
          setVehicles(draft.vehicles || [])
        } else {
          Taro.removeStorageSync(STORAGE_KEY)
        }
      }
    })
  })

  const handleDateChange = (e: {detail: {value: string}}) => {
    setSelectedDate(e.detail.value)
  }

  const handleOvertimeChange = (e: {detail: {value: boolean}}) => {
    setIsOvertime(e.detail.value)
  }

  const addVehicle = useCallback(() => {
    const newCard: VehicleCard = {
      id: `vehicle_${Date.now()}_${Math.random()}`,
      plate_number: '',
      route: '',
      fee_items: [],
      receipt_images: [],
      total: 0
    }
    setVehicles((prev) => {
      const nextVehicles = [...prev, newCard]
      setActiveVehicleIndex(nextVehicles.length - 1)
      return nextVehicles
    })
  }, [])

  const updateVehicle = (index: number, card: VehicleCard) => {
    const newVehicles = [...vehicles]
    newVehicles[index] = card
    setVehicles(newVehicles)
  }

  const deleteVehicle = (index: number) => {
    const newVehicles = vehicles.filter((_, i) => i !== index)
    setVehicles(newVehicles)
    setActiveVehicleIndex((prev) => {
      if (newVehicles.length === 0) return 0
      if (index < prev) return prev - 1
      if (index === prev) return Math.max(0, prev - 1)
      return prev
    })
  }

  const getTotalExpense = () => {
    return vehicles.reduce((sum, v) => sum + v.total, 0)
  }

  const currentVehicle = vehicles[activeVehicleIndex]

  const verifyDriverIsActive = async () => {
    if (!driver) {
      Taro.showToast({title: '请先登录', icon: 'none'})
      return null
    }

    const {data: latestDriver, error: verifyError} = await getDriverById(driver.id)
    if (verifyError) {
      Taro.showToast({title: '网络异常，请重试', icon: 'none'})
      return null
    }

    if (!latestDriver || !latestDriver.is_active) {
      Taro.removeStorageSync('driver_info')
      Taro.showModal({
        title: '账号已停用',
        content: '您的账号已被管理员停用，无法提交报账。请联系客服',
        showCancel: false,
        success: () => {
          Taro.reLaunch({url: '/pages/login/index'})
        }
      })
      return null
    }

    Taro.setStorageSync('driver_info', latestDriver)
    return latestDriver
  }

  // 点击"提交报账"：校验 → 检查车牌 → 弹确认层
  const handleSubmit = async () => {
    if (loading) return

    const activeDriver = await verifyDriverIsActive()
    if (!activeDriver) {
      return
    }

    if (!selectedDate) {
      Taro.showToast({title: '请选择报账日期', icon: 'none'})
      return
    }

    if (vehicles.length === 0) {
      Taro.showToast({title: '请至少添加一辆车', icon: 'none'})
      return
    }

    // 表单校验
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i]
      if (!v.plate_number.trim()) {
        Taro.showToast({title: `第${i + 1}辆车：请输入车牌号`, icon: 'none'})
        return
      }
    }

    // 校验通过，锁定按钮
    setLoading(true)

    // 检查车牌是否在库中
    const {checkVehicleExists} = await import('@/db/api')
    const invalidVehicles: string[] = []
    for (const v of vehicles) {
      const {exists} = await checkVehicleExists(v.plate_number)
      if (!exists) {
        invalidVehicles.push(v.plate_number)
      }
    }

    // 有不在库中的车牌，先弹车牌提示
    if (invalidVehicles.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Taro.showModal({
          title: '车牌提示',
          content: `以下车牌不在公司车辆库中：\n${invalidVehicles.join('、')}\n\n是否继续？`,
          success: (res) => resolve(res.confirm)
        })
      })
      if (!confirmed) {
        setLoading(false)
        return
      }
    }

    // 再弹信息确认层
    setLoading(false)
    setShowConfirm(true)
  }

  // 确认后真正提交
  const handleConfirmSubmit = async () => {
    if (loading) return
    setLoading(true)
    setShowConfirm(false)

    try {
      const activeDriver = await verifyDriverIsActive()
      if (!activeDriver) {
        setLoading(false)
        return
      }

      // 上传所有图片
      const allImages: string[][] = []
      for (const v of vehicles) {
        if (v.receipt_images.length > 0) {
          Taro.showLoading({title: '上传图片中...'})
          const {success, urls, errors} = await uploadFiles(v.receipt_images)
          Taro.hideLoading()

          if (!success) {
            Taro.showToast({title: errors[0] || '图片上传失败', icon: 'none'})
            setLoading(false)
            return
          }
          allImages.push(urls)
        } else {
          allImages.push([])
        }
      }

      // 构建报账记录
      const records: Partial<ExpenseRecord>[] = vehicles.map((v, index) => {
        const feeMap: Record<string, number> = {}
        const feeLocationDetails: string[] = []
        const otherFees: OtherFeeItem[] = []

        for (const item of v.fee_items) {
          if (item.field_name === 'other') {
            if (item.note?.trim()) {
              otherFees.push({
                name: item.note.trim(),
                amount: item.amount,
                sort_order: otherFees.length
              })
            }
          } else {
            feeMap[item.field_name] = (feeMap[item.field_name] || 0) + item.amount
            // 正常费用地点明细写入 fee_location_detail
            if (item.note?.trim()) {
              feeLocationDetails.push(`${item.display_name}(${item.note.trim()}):${item.amount}`)
            }
          }
        }

        return {
          driver_id: activeDriver.id,
          record_date: selectedDate,
          plate_number: v.plate_number,
          route: v.route || null,
          fee_weighing: feeMap.fee_weighing || 0,
          fee_container: feeMap.fee_container || 0,
          fee_overnight: feeMap.fee_overnight || 0,
          fee_vn_overtime: feeMap.fee_vn_overtime || 0,
          fee_vn_key: feeMap.fee_vn_key || 0,
          fee_parking: feeMap.fee_parking || 0,
          fee_newpost: feeMap.fee_newpost || 0,
          fee_taxi: feeMap.fee_taxi || 0,
          fee_water: feeMap.fee_water || 0,
          fee_tarpaulin: feeMap.fee_tarpaulin || 0,
          fee_highway: feeMap.fee_highway || 0,
          fee_stamp: feeMap.fee_stamp || 0,
          note_amount: otherFees.reduce((sum, item) => sum + item.amount, 0),
          fee_location_detail: feeLocationDetails.length > 0 ? feeLocationDetails.join('; ') : null,
          note_detail: otherFees.length > 0 ? otherFees.map((item) => `${item.name}:${item.amount}`).join('; ') : null,
          other_fees: otherFees,
          total_expense: v.total,
          commission: 0,
          receipt_images: allImages[index].length > 0 ? allImages[index] : null,
          status: 'pending',
          is_overtime: isOvertime
        }
      })

      const {error} = await createExpenseRecords(records)

      if (error) {
        Taro.showToast({title: '提交失败，请重试', icon: 'none'})
        setLoading(false)
        return
      }

      Taro.showToast({title: `提交成功，共${vehicles.length}辆车`, icon: 'success'})

      setVehicles([])
      setSelectedDate('')
      setActiveVehicleIndex(0)
      Taro.removeStorageSync(STORAGE_KEY)
      setLoading(false)
    } catch (error) {
      console.error('提交失败:', error)
      Taro.showToast({title: '提交失败，请重试', icon: 'none'})
      setLoading(false)
    }
  }

  // 初始化一个空卡片
  useEffect(() => {
    if (vehicles.length === 0 && feeTypes.length > 0) {
      addVehicle()
    }
  }, [feeTypes, vehicles.length, addVehicle])

  useEffect(() => {
    if (vehicles.length === 0) {
      setActiveVehicleIndex(0)
      return
    }

    if (activeVehicleIndex > vehicles.length - 1) {
      setActiveVehicleIndex(vehicles.length - 1)
    }
  }, [activeVehicleIndex, vehicles.length])

  return (
    <View className="page-shell flex flex-col">
      <View className="surface-card mx-4 mt-4 p-4">
        <View className="flex flex-col space-y-4">
          <View className="flex flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-foreground">司机姓名</Text>
            <Text className="text-lg text-primary font-semibold">{driver?.name}</Text>
          </View>

          <View className="flex flex-col space-y-2">
            <Text className="text-base text-foreground font-medium">报账日期 <Text className="text-destructive">*</Text></Text>
            <View className="flex flex-row items-center space-x-3">
              <Picker mode="date" value={selectedDate || todayStr} onChange={handleDateChange} className="flex-1">
                <View className={`rounded-xl border px-4 py-4 ${selectedDate ? 'bg-input border-border' : 'bg-input border-destructive'}`}>
                  <Text className={`text-base ${selectedDate ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {selectedDate || '请选择日期'}
                  </Text>
                </View>
              </Picker>
              <View
                className="soft-chip px-4 py-4"
                onClick={() => setSelectedDate(todayStr)}>
                <Text className="text-base text-primary font-medium">今天</Text>
              </View>
            </View>
          </View>

          <View className="flex flex-row items-center justify-between">
            <Text className="text-base text-foreground font-medium">是否加班</Text>
            <Switch checked={isOvertime} onChange={handleOvertimeChange} color="#3b82f6" />
          </View>
        </View>
      </View>

      <View className="px-4 py-3">
        <View className="mb-3">
          <ScrollView className="w-full whitespace-nowrap" scrollX enableFlex>
            <View className="flex flex-row items-center gap-3 pr-1">
              {vehicles.map((vehicle, index) => {
                const isActive = index === activeVehicleIndex
                const vehicleLabel = vehicle.plate_number?.trim() || `车辆${index + 1}`

                return (
                  <View
                    key={vehicle.id}
                    className={`relative shrink-0 rounded-full px-4 py-3 ${isActive ? 'bg-primary' : 'bg-card border border-border'}`}
                    onClick={() => setActiveVehicleIndex(index)}>
                    <Text className={`text-base font-semibold ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {vehicleLabel}
                    </Text>
                    {vehicles.length > 1 && (
                      <View
                        className={`absolute -right-1 -top-1 h-5 w-5 rounded-full flex items-center justify-center ${isActive ? 'bg-primary-foreground/25' : 'bg-muted'}`}
                        onClick={(e) => {
                          e.stopPropagation?.()
                          deleteVehicle(index)
                        }}>
                        <Text className={`text-xs font-semibold ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}>×</Text>
                      </View>
                    )}
                  </View>
                )
              })}

              <View
                className="shrink-0 rounded-full border border-dashed border-primary/50 bg-primary/5 px-4 py-3"
                onClick={addVehicle}>
                <Text className="text-lg font-semibold text-primary">+</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      <ScrollView className="w-full flex-1" scrollY>
        <View className="px-4 pt-1 pb-6">
          {currentVehicle && (
            <VehicleCardComponent
              key={currentVehicle.id}
              card={currentVehicle}
              feeTypes={feeTypes}
              onChange={(card) => updateVehicle(activeVehicleIndex, card)}
              onDelete={() => deleteVehicle(activeVehicleIndex)}
            />
          )}
        </View>
      </ScrollView>

      <View className="border-t border-border bg-background/95 px-4 pb-6 pt-4">
        <View className="surface-card bg-primary/10 p-4 mb-2">
            <View className="flex flex-row items-center justify-between">
              <Text className="text-base text-foreground font-medium">今日费用合计</Text>
              <Text className="text-2xl font-bold text-primary">¥{getTotalExpense().toFixed(2)}</Text>
            </View>
          </View>

        <Button
          className="w-full bg-primary text-primary-foreground rounded-xl"
          onClick={handleSubmit}
          disabled={loading}>
          <View className="py-3">
            <Text className="text-base font-semibold">{loading ? '处理中...' : '提交报账'}</Text>
          </View>
        </Button>
      </View>

      {/* 底部确认弹出层 */}
      {showConfirm && (
        <View className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* 遮罩 */}
          <View
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowConfirm(false)}
          />

          {/* 弹出内容 */}
          <View className="relative bg-card rounded-t-3xl z-10" style={{maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
            {/* 固定头部 */}
            <View className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
              <View className="flex flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-foreground">请确认报账信息</Text>
                <View onClick={() => setShowConfirm(false)}>
                  <View className="i-mdi-close text-muted-foreground text-3xl" />
                </View>
              </View>
              <View className="flex flex-row justify-between mt-3">
                <Text className="text-lg text-muted-foreground">司机：{driver?.name}</Text>
                <Text className="text-lg text-muted-foreground">日期：{selectedDate}</Text>
              </View>
              <Text className={`text-lg mt-1 ${isOvertime ? 'text-orange-500' : 'text-muted-foreground'}`}>
                加班：{isOvertime ? '是 ⚡' : '否'}
              </Text>
            </View>

            {/* 可滚动内容 */}
            <ScrollView scrollY style={{flex: 1, overflow: 'hidden'}}>
              <View className="px-6 py-4 flex flex-col space-y-5">
                {vehicles.map((v) => (
                  <View key={v.id} className="bg-muted rounded-2xl p-4">
                    {/* 车辆标题行 */}
                    <View className="flex flex-row items-center justify-between mb-2">
                      <Text className="text-xl font-semibold text-foreground">🚗 {v.plate_number}</Text>
                      <Text className="text-xl font-bold text-primary">¥{v.total.toFixed(2)}</Text>
                    </View>

                    {/* 路线 */}
                    {v.route ? (
                      <Text className="text-lg text-muted-foreground mb-2">📍 {v.route}</Text>
                    ) : null}

                    {/* 费用明细 */}
                    <View className="flex flex-col space-y-1 ml-2">
                      {v.fee_items.map((item) => (
                        <View key={item.id} className="flex flex-row justify-between">
                          <Text className="text-lg text-foreground">
                            {item.field_name === 'other'
                              ? `其他（${item.note}）`
                              : item.note?.trim()
                                ? `${item.display_name}（${item.note.trim()}）`
                                : item.display_name}
                          </Text>
                          <Text className="text-lg text-foreground">¥{item.amount.toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>

                    {/* 图片 */}
                    {v.receipt_images.length > 0 && (
                      <View className="mt-3">
                        <Text className="text-lg text-muted-foreground mb-2">📎 凭证图片 {v.receipt_images.length} 张</Text>
                        <View className="flex flex-row flex-wrap gap-2">
                          {v.receipt_images.map((img) => (
                            <Image
                              key={img.path}
                              src={img.path}
                              className="w-16 h-16 rounded-lg"
                              mode="aspectFill"
                              onClick={() => Taro.previewImage({
                                urls: v.receipt_images.map(i => i.path),
                                current: img.path
                              })}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                  </View>
                ))}

                {/* 总计 */}
                <View className="bg-primary/10 rounded-2xl p-4">
                  <View className="flex flex-row items-center justify-between">
                    <Text className="text-xl font-semibold text-foreground">总计</Text>
                    <Text className="text-2xl font-bold text-primary">¥{getTotalExpense().toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* 固定底部按钮 */}
            <View className="px-6 py-4 flex flex-row space-x-4 border-t border-border flex-shrink-0">
              <View
                className="flex-1 bg-muted rounded-2xl py-4 flex items-center justify-center"
                onClick={() => setShowConfirm(false)}>
                <Text className="text-xl font-semibold text-foreground">返回修改</Text>
              </View>
              <View
                className="flex-1 bg-primary rounded-2xl py-4 flex items-center justify-center"
                onClick={handleConfirmSubmit}>
                <Text className="text-xl font-semibold text-primary-foreground">确认提交</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default withRouteGuard(Submit)
