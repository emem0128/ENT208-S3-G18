// 报账记录编辑页
import {Button, Image, Input, Picker, ScrollView, Text, Textarea, View} from '@tarojs/components'
import Taro, {useDidShow} from '@tarojs/taro'
import {useCallback, useEffect, useState} from 'react'
import FeeRow from '@/components/FeeRow'
import {withRouteGuard} from '@/components/RouteGuard'
import {checkVehicleExists, fetchOtherFees, getExpenseRecordById, getFeeTypes, updateExpenseRecord} from '@/db/api'
import type {ExpenseRecord, FeeItem, FeeType, OtherFeeItem, UploadFileInput} from '@/db/types'
import {parseFeeLocationDetail} from '@/utils/feeLocation'
import {chooseImages, getImageUrl, uploadFiles} from '@/utils/upload'

function RecordEdit() {
  const [record, setRecord] = useState<ExpenseRecord | null>(null)
  const [recordDate, setRecordDate] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [route, setRoute] = useState('')
  const [feeItems, setFeeItems] = useState<FeeItem[]>([])
  const [receiptImages, setReceiptImages] = useState<UploadFileInput[]>([])
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [loading, setLoading] = useState(false)

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

    const recordId = Number(id)
    const {data: recordData} = await getExpenseRecordById(recordId)
    if (!recordData) {
      Taro.showToast({
        title: '记录不存在',
        icon: 'none'
      })
      return
    }

    if (recordData.status !== 'pending') {
      Taro.showToast({
        title: '已确认的记录不可编辑',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
      return
    }

    setRecord(recordData)
    setRecordDate(recordData.record_date || '')
    setPlateNumber(recordData.plate_number)
    setRoute(recordData.route || '')
    setExistingImages(recordData.receipt_images || [])

    // 构建费用项
    const items: FeeItem[] = []
    const feeFields = [
      {field: 'fee_weighing', name: '过磅费'},
      {field: 'fee_container', name: '提柜费'},
      {field: 'fee_overnight', name: '过夜费'},
      {field: 'fee_vn_overtime', name: '越南超时费'},
      {field: 'fee_vn_key', name: '越南收钥匙'},
      {field: 'fee_parking', name: '停车费'},
      {field: 'fee_newpost', name: '新岗'},
      {field: 'fee_taxi', name: '打车'},
      {field: 'fee_water', name: '淋水'},
      {field: 'fee_tarpaulin', name: '解篷布'},
      {field: 'fee_highway', name: '高速费'},
      {field: 'fee_stamp', name: '盖章'}
    ]

    // 解析 fee_location_detail，提取正常费用的地点备注
    // 格式：停车费(北投):35; 过磅费(桂福):10
    const noteMap: Record<string, string[]> = {} // field_name -> [note, note, ...]
    const locationMap = parseFeeLocationDetail(recordData.fee_location_detail)
    Object.entries(locationMap).forEach(([displayName, items]) => {
      const found = feeFields.find((f) => f.name === displayName)
      if (!found) return

      noteMap[found.field] = items.map((item) => item.location)
    })

    for (const {field, name} of feeFields) {
      const amount = recordData[field as keyof ExpenseRecord] as number
      if (amount > 0) {
        const notes = noteMap[field] || []
        if (notes.length > 1) {
          // 同一费用有多条备注，拆成多行（金额无法还原各自的，均摊显示总额）
          notes.forEach((note) => {
            items.push({
              id: `fee_${Date.now()}_${Math.random()}`,
              field_name: field,
              display_name: name,
              amount,
              note
            })
          })
        } else {
          items.push({
            id: `fee_${Date.now()}_${Math.random()}`,
            field_name: field,
            display_name: name,
            amount,
            note: notes[0] || ''
          })
        }
      }
    }

    // 解析 note_detail，提取 other 费用描述
    // 格式：修车费:333; 补胎:60
    const {data: fetchedOtherFees} = await fetchOtherFees(recordId)
    const otherItems: FeeItem[] = []

    if (fetchedOtherFees.length > 0) {
      fetchedOtherFees.forEach((item) => {
        otherItems.push({
          id: `other_${item.id || Date.now()}_${Math.random()}`,
          field_name: 'other',
          display_name: '其他',
          amount: Number(item.amount) || 0,
          note: item.name
        })
      })
    } else if (recordData.note_detail) {
      const parts = recordData.note_detail.split(';').map((s) => s.trim()).filter(Boolean)
      for (const part of parts) {
        const match = part.match(/^(.+?):(-?\d+(\.\d+)?)$/)
        if (!match) continue
        const otherName = match[1].trim()
        const otherAmount = Number.parseFloat(match[2])
        if (!otherName || Number.isNaN(otherAmount)) continue
        otherItems.push({
          id: `fee_${Date.now()}_${Math.random()}`,
          field_name: 'other',
          display_name: '其他',
          amount: otherAmount,
          note: otherName
        })
      }
    }

    if (otherItems.length > 0) {
      items.push(...otherItems)
    } else if (recordData.note_amount > 0) {
      // 向后兼容旧数据：只有 note_amount，没有可解析的 note_detail
      items.push({
        id: `fee_${Date.now()}_${Math.random()}`,
        field_name: 'other',
        display_name: '其他',
        amount: recordData.note_amount,
        note: ''
      })
    }

    setFeeItems(items)
    setNote('')

    const {data: types} = await getFeeTypes()
    setFeeTypes(types)
  }, [])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const addFeeItem = () => {
    const newItem: FeeItem = {
      id: `fee_${Date.now()}_${Math.random()}`,
      field_name: '',
      display_name: '',
      amount: 0
    }
    setFeeItems([...feeItems, newItem])
  }

  const addOtherFeeItem = () => {
    const newItem: FeeItem = {
      id: `other_${Date.now()}_${Math.random()}`,
      field_name: 'other',
      display_name: '其他',
      amount: 0,
      note: ''
    }
    setFeeItems([...feeItems, newItem])
  }

  const updateFeeItem = (itemId: string, item: FeeItem) => {
    const newItems = feeItems.map((fee) => (fee.id === itemId ? item : fee))
    setFeeItems(newItems)
  }

  const deleteFeeItem = (itemId: string) => {
    const newItems = feeItems.filter((item) => item.id !== itemId)
    setFeeItems(newItems)
  }

  const handleChooseImages = async () => {
    const currentCount = receiptImages.length + existingImages.length
    const maxCount = 9 - currentCount

    if (maxCount <= 0) {
      Taro.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      })
      return
    }

    const images = await chooseImages(maxCount)
    if (images.length > 0) {
      setReceiptImages([...receiptImages, ...images])
    }
  }

  const deleteNewImage = (index: number) => {
    const newImages = receiptImages.filter((_, i) => i !== index)
    setReceiptImages(newImages)
  }

  const deleteExistingImage = (index: number) => {
    const newImages = existingImages.filter((_, i) => i !== index)
    setExistingImages(newImages)
  }

  const previewImage = (url: string) => {
    const allUrls = [
      ...existingImages.map((img) => getImageUrl(img)),
      ...receiptImages.map((img) => img.path)
    ]
    Taro.previewImage({
      urls: allUrls,
      current: url
    })
  }

  const handleSave = async () => {
    if (!record) return

    if (!recordDate) {
      Taro.showToast({
        title: '请选择报账日期',
        icon: 'none'
      })
      return
    }

    if (!plateNumber.trim()) {
      Taro.showToast({
        title: '请输入车牌号',
        icon: 'none'
      })
      return
    }

    if (feeItems.length === 0) {
      Taro.showToast({
        title: '请至少添加一条费用',
        icon: 'none'
      })
      return
    }

    for (const item of feeItems) {
      if (!item.field_name) {
        Taro.showToast({
          title: '请选择费用类型',
          icon: 'none'
        })
        return
      }
      if (item.field_name === 'other' && !item.note?.trim()) {
        Taro.showToast({
          title: '请输入"其他"费用名称',
          icon: 'none'
        })
        return
      }
    }

    // 检查车牌
    const {exists} = await checkVehicleExists(plateNumber)
    if (!exists) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Taro.showModal({
          title: '提示',
          content: `车牌"${plateNumber}"不在公司车辆库中，是否继续保存？`,
          success: (res) => resolve(res.confirm)
        })
      })

      if (!confirmed) return
    }

    setLoading(true)

    try {
      // 上传新图片
      let uploadedUrls: string[] = []
      if (receiptImages.length > 0) {
        Taro.showLoading({title: '上传图片中...'})
        const {success, urls, errors} = await uploadFiles(receiptImages)
        Taro.hideLoading()

        if (!success) {
          Taro.showToast({
            title: errors[0] || '图片上传失败',
            icon: 'none'
          })
          setLoading(false)
          return
        }
        uploadedUrls = urls
      }

      // 合并图片
      const allImages = [...existingImages, ...uploadedUrls]

      // 构建费用数据
      const feeMap: Record<string, number> = {}
      const feeLocationDetails: string[] = []
      const otherFees: OtherFeeItem[] = []

      for (const item of feeItems) {
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
          if (item.note?.trim()) {
            feeLocationDetails.push(`${item.display_name}(${item.note.trim()}):${item.amount}`)
          }
        }
      }

      const totalExpense = feeItems.reduce((sum, item) => sum + item.amount, 0)

      const updates: Partial<ExpenseRecord> = {
        record_date: recordDate,
        plate_number: plateNumber,
        route: route || null,
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
        total_expense: totalExpense,
        receipt_images: allImages.length > 0 ? allImages : null
      }

      const {error} = await updateExpenseRecord(record.id, updates)

      if (error) {
        Taro.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        })
        setLoading(false)
        return
      }

      Taro.showToast({
        title: '修改成功',
        icon: 'success'
      })

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
      setLoading(false)
    }
  }

  if (!record) {
    return (
      <View className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center">
        <View className="i-mdi-loading animate-spin text-primary text-6xl mb-4" />
        <Text className="text-xl text-muted-foreground">加载中...</Text>
      </View>
    )
  }

  const normalFeeItems = feeItems.filter((item) => item.field_name !== 'other')
  const otherFeeItems = feeItems.filter((item) => item.field_name === 'other')
  const normalFeeTypes = feeTypes.filter((item) => item.field_name !== 'other')

  return (
    <View className="min-h-screen bg-gradient-subtle">
      <ScrollView className="w-full" scrollY>
        <View className="px-4 py-6">
          <View className="bg-card rounded-2xl p-6 shadow-elegant mb-6">
            <View className="flex flex-col space-y-4">
              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">报账日期</Text>
                <Picker mode="date" value={recordDate} onChange={(e) => setRecordDate(e.detail.value)}>
                  <View className="bg-input rounded-xl border border-border px-4 py-4">
                    <Text className="text-foreground text-xl">{recordDate || '请选择日期'}</Text>
                  </View>
                </Picker>
              </View>

              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">车牌号</Text>
                <View className="bg-input rounded-xl border border-border px-4 py-4">
                  <Input
                    className="w-full text-foreground text-xl"
                    placeholder="请输入车牌号"
                    value={plateNumber}
                    onInput={(e) => setPlateNumber(e.detail.value)}
                  />
                </View>
              </View>

              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">路线/地点（选填）</Text>
                <View className="bg-input rounded-xl border border-border px-4 py-4">
                  <Input
                    className="w-full text-foreground text-xl"
                    placeholder="如：越南—桂福"
                    value={route}
                    onInput={(e) => setRoute(e.detail.value)}
                  />
                </View>
              </View>

              <View className="flex flex-col space-y-3">
                <Text className="text-xl text-foreground font-medium">普通费用</Text>
                <View className="flex flex-col gap-2">
                  {normalFeeItems.map((item) => (
                    <FeeRow
                      key={item.id}
                      feeItem={item}
                      feeTypes={normalFeeTypes}
                      onChange={(newItem) => updateFeeItem(item.id, newItem)}
                      onDelete={() => deleteFeeItem(item.id)}
                    />
                  ))}
                </View>
                <View
                  className="flex flex-row items-center justify-center py-3 bg-muted rounded-xl"
                  onClick={addFeeItem}>
                  <View className="i-mdi-plus-circle text-primary text-2xl mr-2" />
                  <Text className="text-xl text-primary font-medium">添加费用</Text>
                </View>
              </View>

              <View className="flex flex-col space-y-3 border-t border-border/60 pt-4">
                <Text className="text-xl text-foreground font-medium">其他费用</Text>
                <View className="flex flex-col gap-2">
                  {otherFeeItems.map((item) => (
                    <View key={item.id} className="flex flex-row items-center gap-3">
                      <View className="min-w-0 basis-3/5 bg-input rounded-xl border border-border px-4 py-4">
                        <Input
                          className="w-full text-foreground text-xl"
                          placeholder="请输入费用名称"
                          value={item.note || ''}
                          onInput={(e) =>
                            updateFeeItem(item.id, {
                              ...item,
                              note: e.detail.value
                            })
                          }
                        />
                      </View>
                      <View className="basis-2/5 bg-input rounded-xl border border-border px-4 py-4">
                        <Input
                          className="w-full text-right text-foreground text-xl"
                          type="digit"
                          placeholder="金额"
                          value={item.amount > 0 ? String(item.amount) : ''}
                          onInput={(e) =>
                            updateFeeItem(item.id, {
                              ...item,
                              amount: e.detail.value ? Number.parseFloat(e.detail.value) : 0
                            })
                          }
                        />
                      </View>
                      <View
                        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-destructive/10"
                        onClick={() => deleteFeeItem(item.id)}>
                        <View className="i-mdi-close text-destructive text-2xl" />
                      </View>
                    </View>
                  ))}
                </View>
                <View
                  className="flex flex-row items-center justify-center py-3 rounded-xl border border-dashed border-emerald-500/60 bg-emerald-500/5"
                  onClick={addOtherFeeItem}>
                  <View className="i-mdi-plus-circle text-emerald-600 text-2xl mr-2" />
                  <Text className="text-xl text-emerald-600 font-medium">添加其他费用</Text>
                </View>
              </View>

              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">凭证图片（选填，最多9张）</Text>
                <View className="flex flex-row flex-wrap gap-3">
                  {existingImages.map((img, index) => (
                    <View key={img} className="relative w-24 h-24">
                      <Image
                        src={getImageUrl(img)}
                        className="w-full h-full rounded-xl"
                        mode="aspectFill"
                        onClick={() => previewImage(getImageUrl(img))}
                      />
                      <View
                        className="absolute top-0 right-0 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
                        onClick={() => deleteExistingImage(index)}>
                        <View className="i-mdi-close text-white text-lg" />
                      </View>
                    </View>
                  ))}
                  {receiptImages.map((img, index) => (
                    <View key={img.path} className="relative w-24 h-24">
                      <Image
                        src={img.path}
                        className="w-full h-full rounded-xl"
                        mode="aspectFill"
                        onClick={() => previewImage(img.path)}
                      />
                      <View
                        className="absolute top-0 right-0 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
                        onClick={() => deleteNewImage(index)}>
                        <View className="i-mdi-close text-white text-lg" />
                      </View>
                    </View>
                  ))}
                  {receiptImages.length + existingImages.length < 9 && (
                    <View
                      className="w-24 h-24 bg-muted rounded-xl flex flex-col items-center justify-center"
                      onClick={handleChooseImages}>
                      <View className="i-mdi-camera-plus text-muted-foreground text-4xl mb-1" />
                      <Text className="text-lg text-muted-foreground">上传</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">备注（选填）</Text>
                <View className="bg-input rounded-xl border border-border px-4 py-4">
                  <Textarea
                    className="w-full text-foreground text-xl"
                    placeholder="其他说明"
                    value={note}
                    onInput={(e) => setNote(e.detail.value)}
                    maxlength={200}
                    autoHeight
                  />
                </View>
              </View>
            </View>
          </View>

          <Button
            className="w-full bg-primary text-primary-foreground text-2xl font-semibold rounded-2xl mb-6"
            onClick={handleSave}
            disabled={loading}>
            <View className="py-4">
              <Text>{loading ? '保存中...' : '保存修改'}</Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}

export default withRouteGuard(RecordEdit)
