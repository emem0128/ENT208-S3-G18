// 报账记录编辑页
import {View, Text, Input, Textarea, Image, Button, ScrollView, Picker} from '@tarojs/components'
import {useState, useEffect, useCallback} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import type {ExpenseRecord, FeeType, FeeItem, UploadFileInput} from '@/db/types'
import {getExpenseRecordById, updateExpenseRecord, getFeeTypes, checkVehicleExists} from '@/db/api'
import {chooseImages, uploadFiles, getImageUrl} from '@/utils/upload'
import FeeRow from '@/components/FeeRow'

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

    const {data: recordData} = await getExpenseRecordById(Number(id))
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
    setNote(recordData.note_detail || '')
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

    // 解析 note_detail，提取各费用的备注
    // 格式：停车费(北投):35; 停车费(桂福):20; 其他名称:金额
    const noteMap: Record<string, string[]> = {} // field_name -> [note, note, ...]
    let otherNoteDetail = ''

    if (recordData.note_detail) {
      const parts = recordData.note_detail.split(';').map((s) => s.trim()).filter(Boolean)
      for (const part of parts) {
        // 匹配 "费用名(备注):金额" 格式
        const match = part.match(/^(.+?)\((.+?)\):\d+(\.\d+)?$/)
        if (match) {
          const displayName = match[1].trim()
          const noteText = match[2].trim()
          const found = feeFields.find((f) => f.name === displayName)
          if (found) {
            if (!noteMap[found.field]) noteMap[found.field] = []
            noteMap[found.field].push(noteText)
          }
        } else {
          // 不匹配的归入 other 备注
          otherNoteDetail = otherNoteDetail ? `${otherNoteDetail}; ${part}` : part
        }
      }
    }

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

    if (recordData.note_amount > 0) {
      items.push({
        id: `fee_${Date.now()}_${Math.random()}`,
        field_name: 'other',
        display_name: '其他',
        amount: recordData.note_amount,
        note: otherNoteDetail || recordData.note_detail || ''
      })
    }

    setFeeItems(items)

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

  const updateFeeItem = (index: number, item: FeeItem) => {
    const newItems = [...feeItems]
    newItems[index] = item
    setFeeItems(newItems)
  }

  const deleteFeeItem = (index: number) => {
    const newItems = feeItems.filter((_, i) => i !== index)
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
      let noteAmount = 0
      const noteDetails: string[] = []

      for (const item of feeItems) {
        if (item.field_name === 'other') {
          noteAmount += item.amount
          if (item.note) {
            noteDetails.push(`${item.note}:${item.amount}`)
          }
        } else {
          feeMap[item.field_name] = (feeMap[item.field_name] || 0) + item.amount
          if (item.note?.trim()) {
            noteDetails.push(`${item.display_name}(${item.note.trim()}):${item.amount}`)
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
        note_amount: noteAmount,
        note_detail: noteDetails.length > 0 ? noteDetails.join('; ') : note || null,
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
                <Text className="text-xl text-foreground font-medium">费用明细</Text>
                {feeItems.map((item, index) => (
                  <FeeRow
                    key={item.id}
                    feeItem={item}
                    feeTypes={feeTypes}
                    onChange={(newItem) => updateFeeItem(index, newItem)}
                    onDelete={() => deleteFeeItem(index)}
                  />
                ))}
                <View
                  className="flex flex-row items-center justify-center py-3 bg-muted rounded-xl"
                  onClick={addFeeItem}>
                  <View className="i-mdi-plus-circle text-primary text-2xl mr-2" />
                  <Text className="text-xl text-primary font-medium">添加费用</Text>
                </View>
              </View>

              <View className="flex flex-col space-y-2">
                <Text className="text-xl text-foreground font-medium">凭证图片（选填，最多9张）</Text>
                <View className="flex flex-row flex-wrap gap-3">
                  {existingImages.map((img, index) => (
                    <View key={`existing_${index}`} className="relative w-24 h-24">
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
                    <View key={`new_${index}`} className="relative w-24 h-24">
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
