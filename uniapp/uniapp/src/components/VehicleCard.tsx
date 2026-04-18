// 车辆卡片组件
import {View, Text, Input, Textarea, Image} from '@tarojs/components'
import {useState, useEffect} from 'react'
import Taro from '@tarojs/taro'
import type {VehicleCard, FeeType, FeeItem, UploadFileInput} from '@/db/types'
import {searchVehicles, checkVehicleExists} from '@/db/api'
import {chooseImages} from '@/utils/upload'
import FeeRow from './FeeRow'

interface VehicleCardProps {
  card: VehicleCard
  feeTypes: FeeType[]
  onChange: (card: VehicleCard) => void
  onDelete: () => void
}

export default function VehicleCardComponent({card, feeTypes, onChange, onDelete}: VehicleCardProps) {
  const [plateSearch, setPlateSearch] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [plateValid, setPlateValid] = useState<'valid' | 'invalid' | 'unknown'>('unknown')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (card.plate_number) {
      checkVehicleExists(card.plate_number).then(({exists}) => {
        setPlateValid(exists ? 'valid' : 'invalid')
      })
    }
  }, [card.plate_number])

  const handlePlateSearch = async (value: string) => {
    setPlateSearch(value)
    onChange({...card, plate_number: value})

    if (value.length >= 2) {
      const {data} = await searchVehicles(value)
      setSearchResults(data.map((v) => v.plate_number))
      setShowSearch(true)
    } else {
      setSearchResults([])
      setShowSearch(false)
    }
  }

  const selectPlate = (plate: string) => {
    setPlateSearch(plate)
    onChange({...card, plate_number: plate})
    setShowSearch(false)
  }

  const addFeeItem = () => {
    const newItem: FeeItem = {
      id: `fee_${Date.now()}_${Math.random()}`,
      field_name: '',
      display_name: '',
      amount: 0
    }
    onChange({
      ...card,
      fee_items: [...card.fee_items, newItem]
    })
  }

  const updateFeeItem = (index: number, item: FeeItem) => {
    const newItems = [...card.fee_items]
    newItems[index] = item
    const total = newItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    onChange({
      ...card,
      fee_items: newItems,
      total
    })
  }

  const deleteFeeItem = (index: number) => {
    const newItems = card.fee_items.filter((_, i) => i !== index)
    const total = newItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    onChange({
      ...card,
      fee_items: newItems,
      total
    })
  }

  const handleChooseImages = async () => {
    const currentCount = card.receipt_images.length
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
      onChange({
        ...card,
        receipt_images: [...card.receipt_images, ...images]
      })
    }
  }

  const deleteImage = (index: number) => {
    const newImages = card.receipt_images.filter((_, i) => i !== index)
    onChange({
      ...card,
      receipt_images: newImages
    })
  }

  const previewImage = (index: number) => {
    Taro.previewImage({
      urls: card.receipt_images.map((img) => img.path),
      current: card.receipt_images[index].path
    })
  }

  const borderColor =
    plateValid === 'valid' ? 'border-green-500' : plateValid === 'invalid' ? 'border-orange-500' : 'border-border'

  return (
    <View className="bg-card rounded-2xl p-6 shadow-elegant mb-4">
      <View className="flex flex-row items-center justify-between mb-4" onClick={() => setCollapsed(!collapsed)}>
        <View className="flex flex-col flex-1">
          <Text className="text-2xl font-semibold text-foreground">
            {card.plate_number || '车辆信息'}
          </Text>
          {collapsed && (
            <Text className="text-lg text-primary mt-1">¥{card.total.toFixed(2)}</Text>
          )}
        </View>
        <View className="flex flex-row items-center space-x-3">
          <View className="w-10 h-10 flex items-center justify-center" onClick={(e) => { e.stopPropagation?.(); onDelete() }}>
            <View className="i-mdi-delete text-destructive text-3xl" />
          </View>
          <View className="w-10 h-10 flex items-center justify-center">
            <View className={`${collapsed ? 'i-mdi-chevron-down' : 'i-mdi-chevron-up'} text-muted-foreground text-3xl`} />
          </View>
        </View>
      </View>

      {!collapsed && (
      <View className="flex flex-col space-y-4">
        <View className="flex flex-col space-y-2">
          <Text className="text-xl text-foreground font-medium">车牌号</Text>
          <View className={`bg-input rounded-xl border-2 ${borderColor} px-4 py-4`}>
            <Input
              className="w-full text-foreground text-xl"
              placeholder="输入车牌号搜索"
              value={plateSearch || card.plate_number}
              onInput={(e) => handlePlateSearch(e.detail.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearch(true)
              }}
            />
          </View>
          {plateValid === 'invalid' && (
            <Text className="text-lg text-orange-500">⚠️ 该车牌不在公司车辆库中</Text>
          )}
          {showSearch && searchResults.length > 0 && (
            <View className="bg-card border border-border rounded-xl max-h-48 overflow-y-auto">
              {searchResults.map((plate) => (
                <View
                  key={plate}
                  className="px-4 py-3 border-b border-border"
                  onClick={() => selectPlate(plate)}>
                  <Text className="text-xl text-foreground">{plate}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="flex flex-col space-y-2">
          <Text className="text-xl text-foreground font-medium">路线/地点（选填）</Text>
          <View className="bg-input rounded-xl border border-border px-4 py-4">
            <Input
              className="w-full text-foreground text-xl"
              placeholder="如：越南—桂福"
              value={card.route}
              onInput={(e) => onChange({...card, route: e.detail.value})}
            />
          </View>
        </View>

        <View className="flex flex-col space-y-3">
          <Text className="text-xl text-foreground font-medium">费用明细</Text>
          {card.fee_items.map((item, index) => (
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
            {card.receipt_images.map((img, index) => (
              <View key={index} className="relative w-24 h-24">
                <Image
                  src={img.path}
                  className="w-full h-full rounded-xl"
                  mode="aspectFill"
                  onClick={() => previewImage(index)}
                />
                <View
                  className="absolute top-0 right-0 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
                  onClick={() => deleteImage(index)}>
                  <View className="i-mdi-close text-white text-lg" />
                </View>
              </View>
            ))}
            {card.receipt_images.length < 9 && (
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
              value={card.note}
              onInput={(e) => onChange({...card, note: e.detail.value})}
              maxlength={200}
              autoHeight
            />
          </View>
        </View>

        <View className="bg-primary/10 rounded-xl p-4">
          <View className="flex flex-row items-center justify-between">
            <Text className="text-xl text-foreground font-medium">本车费用小计</Text>
            <Text className="text-2xl font-bold text-primary">¥{card.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
      )}
    </View>
  )
}
