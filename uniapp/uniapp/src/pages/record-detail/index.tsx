// 报账记录详情页
import {View, Text, Image, ScrollView} from '@tarojs/components'
import {useState, useEffect, useCallback} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import type {ExpenseRecord, OtherFeeItem} from '@/db/types'
import {fetchOtherFees, getExpenseRecordById} from '@/db/api'
import {parseFeeLocationDetail} from '@/utils/feeLocation'
import {getImageUrl} from '@/utils/upload'

function RecordDetail() {
  const [record, setRecord] = useState<ExpenseRecord | null>(null)
  const [otherFees, setOtherFees] = useState<OtherFeeItem[]>([])
  const [loading, setLoading] = useState(true)

  const renderFeeItem = useCallback(
    (label: string, amount: number) => {
      if (amount <= 0 || !record) return null

      const locationDetails = parseFeeLocationDetail(record.fee_location_detail)[label] || []

      return (
        <View className="flex flex-col space-y-1">
          <View className="flex flex-row items-center justify-between">
            <Text className="text-xl text-muted-foreground">{label}</Text>
            <Text className="text-xl text-foreground font-medium">¥{amount.toFixed(2)}</Text>
          </View>
          {locationDetails.length > 0 && (
            <View className="flex flex-col space-y-1">
              {locationDetails.map((item, index) => (
                <Text key={`${label}-${item.location}-${index}`} className="text-lg text-muted-foreground">
                  {item.location}: ¥{item.amount.toFixed(2)}
                </Text>
              ))}
            </View>
          )}
        </View>
      )
    },
    [record]
  )

  const loadData = useCallback(async () => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id

    if (!id) {
      Taro.showToast({
        title: '参数错误',
        icon: 'none'
      })
      return
    }

    setLoading(true)
    const recordId = Number(id)
    const [{data}, {data: otherFeesData}] = await Promise.all([
      getExpenseRecordById(recordId),
      fetchOtherFees(recordId)
    ])
    setRecord(data)
    setOtherFees(otherFeesData)
    setLoading(false)
  }, [])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const previewImage = (index: number) => {
    if (!record?.receipt_images) return
    const urls = record.receipt_images.map((img) => getImageUrl(img))
    Taro.previewImage({
      urls,
      current: urls[index]
    })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center">
        <View className="i-mdi-loading animate-spin text-primary text-6xl mb-4" />
        <Text className="text-xl text-muted-foreground">加载中...</Text>
      </View>
    )
  }

  if (!record) {
    return (
      <View className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center">
        <View className="i-mdi-alert-circle text-muted-foreground text-6xl mb-4" />
        <Text className="text-2xl text-muted-foreground">记录不存在</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gradient-subtle">
      <ScrollView className="w-full" scrollY>
        <View className="px-4 py-6">
          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <View className="flex flex-row items-center justify-between mb-4">
              <Text className="text-3xl font-bold text-foreground">{record.plate_number}</Text>
              {record.status === 'pending' ? (
                <View className="bg-orange-100 px-4 py-2 rounded-xl">
                  <Text className="text-xl text-orange-600 font-semibold">⏳ 待确认</Text>
                </View>
              ) : (
                <View className="bg-green-100 px-4 py-2 rounded-xl">
                  <Text className="text-xl text-green-600 font-semibold">✅ 已确认</Text>
                </View>
              )}
            </View>

            <View className="flex flex-col space-y-4">
              <View className="flex flex-row items-center justify-between">
                <Text className="text-xl text-muted-foreground">日期</Text>
                <Text className="text-xl text-foreground font-medium">{record.record_date}</Text>
              </View>

              {record.route && (
                <View className="flex flex-row items-center justify-between">
                  <Text className="text-xl text-muted-foreground">路线/地点</Text>
                  <Text className="text-xl text-foreground font-medium">{record.route}</Text>
                </View>
              )}
            </View>
          </View>

          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <Text className="text-2xl font-semibold text-foreground mb-4">费用明细</Text>
            <View className="flex flex-col space-y-3">
              {renderFeeItem('过磅费', record.fee_weighing)}
              {renderFeeItem('提柜费', record.fee_container)}
              {renderFeeItem('过夜费', record.fee_overnight)}
              {renderFeeItem('越南超时费', record.fee_vn_overtime)}
              {renderFeeItem('越南收钥匙', record.fee_vn_key)}
              {renderFeeItem('停车费', record.fee_parking)}
              {renderFeeItem('新岗', record.fee_newpost)}
              {renderFeeItem('打车', record.fee_taxi)}
              {renderFeeItem('淋水', record.fee_water)}
              {renderFeeItem('解篷布', record.fee_tarpaulin)}
              {renderFeeItem('高速费', record.fee_highway)}
              {renderFeeItem('盖章', record.fee_stamp)}
              {otherFees.length > 0 ? (
                otherFees.map((item) => (
                  <View key={item.id} className="flex flex-row items-center justify-between">
                    <Text className="text-xl text-muted-foreground">{item.name}</Text>
                    <Text className="text-xl text-foreground font-medium">¥{item.amount.toFixed(2)}</Text>
                  </View>
                ))
              ) : record.note_amount > 0 && (
                <View className="flex flex-col space-y-1">
                  <View className="flex flex-row items-center justify-between">
                    <Text className="text-xl text-muted-foreground">其他费用</Text>
                    <Text className="text-xl text-foreground font-medium">¥{record.note_amount.toFixed(2)}</Text>
                  </View>
                  {record.note_detail && (
                    <Text className="text-lg text-muted-foreground">{record.note_detail}</Text>
                  )}
                </View>
              )}

              <View className="h-px bg-border my-2" />

              <View className="flex flex-row items-center justify-between">
                <Text className="text-2xl text-foreground font-semibold">费用合计</Text>
                <Text className="text-3xl font-bold text-primary">
                  ¥{record.total_expense.toFixed(2)}
                </Text>
              </View>

              {record.commission > 0 && (
                <View className="flex flex-row items-center justify-between">
                  <Text className="text-2xl text-foreground font-semibold">提成</Text>
                  <Text className="text-3xl font-bold text-green-600">
                    ¥{record.commission.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {record.receipt_images && record.receipt_images.length > 0 && (
            <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
              <Text className="text-2xl font-semibold text-foreground mb-4">凭证图片</Text>
              <View className="flex flex-row flex-wrap gap-3">
                {record.receipt_images.map((img, index) => (
                  <Image
                    key={index}
                    src={getImageUrl(img)}
                    className="w-32 h-32 rounded-xl"
                    mode="aspectFill"
                    onClick={() => previewImage(index)}
                  />
                ))}
              </View>
            </View>
          )}

          {record.status === 'confirmed' && (
            <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
              <Text className="text-2xl font-semibold text-foreground mb-4">确认信息</Text>
              <View className="flex flex-col space-y-3">
                {record.confirmed_by && (
                  <View className="flex flex-row items-center justify-between">
                    <Text className="text-xl text-muted-foreground">确认人</Text>
                    <Text className="text-xl text-foreground font-medium">{record.confirmed_by}</Text>
                  </View>
                )}
                {record.confirmed_at && (
                  <View className="flex flex-row items-center justify-between">
                    <Text className="text-xl text-muted-foreground">确认时间</Text>
                    <Text className="text-xl text-foreground font-medium">
                      {new Date(record.confirmed_at).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default withRouteGuard(RecordDetail)
