// 车辆卡片组件
import {Image, Input, Text, View} from '@tarojs/components'
import Taro from '@tarojs/taro'
import {useEffect, useState} from 'react'
import {checkVehicleExists, searchVehicles} from '@/db/api'
import type {FeeItem, FeeType, VehicleCard} from '@/db/types'
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

  const normalizePlateKeyword = (value: string) => value.replace(/\s+/g, '').trim().toUpperCase()

  useEffect(() => {
    setPlateSearch(card.plate_number || '')
  }, [card.plate_number])

  useEffect(() => {
    if (card.plate_number.trim()) {
      checkVehicleExists(card.plate_number).then(({exists}) => {
        setPlateValid(exists ? 'valid' : 'invalid')
      })
    } else {
      setPlateValid('unknown')
    }
  }, [card.plate_number])

  const handlePlateSearch = async (value: string) => {
    setPlateSearch(value)
    onChange({...card, plate_number: value})

    const normalizedValue = normalizePlateKeyword(value)

    if (normalizedValue.length >= 1) {
      const {data} = await searchVehicles(normalizedValue)
      console.log('搜索结果:', data.length, data.map((v) => v.plate_number))
      setSearchResults(data.map((v) => v.plate_number).slice(0, 10))
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
    setSearchResults([])
  }

  const renderHighlightedPlate = (plate: string) => {
    const normalizedKeyword = normalizePlateKeyword(plateSearch)

    if (!normalizedKeyword) {
      return <Text className="text-xl font-semibold text-foreground">{plate}</Text>
    }

    const normalizedPlate = plate.toUpperCase()
    const matchIndex = normalizedPlate.indexOf(normalizedKeyword)

    if (matchIndex === -1) {
      return <Text className="text-xl font-semibold text-foreground">{plate}</Text>
    }

    const before = plate.slice(0, matchIndex)
    const match = plate.slice(matchIndex, matchIndex + normalizedKeyword.length)
    const after = plate.slice(matchIndex + normalizedKeyword.length)

    return (
      <Text className="text-xl font-semibold text-foreground">
        <Text>{before}</Text>
        <Text className="text-primary">{match}</Text>
        <Text>{after}</Text>
      </Text>
    )
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

  const addOtherFeeItem = () => {
    const newItem: FeeItem = {
      id: `other_${Date.now()}_${Math.random()}`,
      field_name: 'other',
      display_name: '其他',
      amount: 0,
      note: ''
    }
    onChange({
      ...card,
      fee_items: [...card.fee_items, newItem]
    })
  }

  const updateFeeItem = (itemId: string, item: FeeItem) => {
    const newItems = card.fee_items.map((fee) => (fee.id === itemId ? item : fee))
    const total = newItems.reduce((sum, fee) => sum + (fee.amount || 0), 0)
    onChange({
      ...card,
      fee_items: newItems,
      total
    })
  }

  const deleteFeeItem = (itemId: string) => {
    const newItems = card.fee_items.filter((item) => item.id !== itemId)
    const total = newItems.reduce((sum, fee) => sum + (fee.amount || 0), 0)
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
    plateValid === 'valid'
      ? 'border-green-500'
      : plateValid === 'invalid'
        ? 'border-orange-500'
        : 'border-border'

  const normalFeeTypes = feeTypes.filter((item) => item.field_name !== 'other')
  const normalFeeItems = card.fee_items.filter((item) => item.field_name !== 'other')
  const otherFeeItems = card.fee_items.filter((item) => item.field_name === 'other')

  return (
    <View className="surface-card p-4 mb-4">
      <View className="flex flex-row items-center justify-between" onClick={() => setCollapsed(!collapsed)}>
        <View className="flex-1">
          <Text className="text-xl font-semibold text-foreground">{card.plate_number || '车辆信息'}</Text>
          <View className="mt-1 inline-flex soft-chip px-3 py-1">
            <Text className="text-base text-primary">小计 ¥{card.total.toFixed(2)}</Text>
          </View>
        </View>

        <View className="flex flex-row items-center gap-2">
          <View
            className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation?.()
              onDelete()
            }}>
            <View className="i-mdi-delete text-destructive text-xl" />
          </View>
          <View className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            <View className={`${collapsed ? 'i-mdi-chevron-down' : 'i-mdi-chevron-up'} text-muted-foreground text-xl`} />
          </View>
        </View>
      </View>

      {!collapsed && (
        <View className="mt-4 flex flex-col gap-4">
          <View>
            <Text className="text-base text-muted-foreground mb-2 block">车牌号</Text>
            <View className={`rounded-xl border-2 ${borderColor} bg-background px-3 py-3`}>
              <Input
                className="w-full text-xl text-foreground"
                placeholder="输入车牌号搜索"
                value={plateSearch}
                onInput={(e) => handlePlateSearch(e.detail.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearch(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowSearch(false), 300)
                }}
              />
            </View>
            {plateValid === 'invalid' && (
              <Text className="mt-2 text-base text-orange-500">该车牌不在公司车辆库中</Text>
            )}
            {showSearch && searchResults.length > 0 && (
              <View className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
                {searchResults.map((plate) => (
                  <View
                    key={plate}
                    className="min-h-12 px-4 py-3 border-b border-border flex items-center"
                    onClick={() => selectPlate(plate)}>
                    {renderHighlightedPlate(plate)}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View>
            <Text className="text-base text-muted-foreground mb-2 block">路线/地点（选填）</Text>
            <View className="rounded-xl border border-border bg-background px-3 py-3">
              <Input
                className="w-full text-lg text-foreground"
                placeholder="如：越南-桂福"
                value={card.route}
                onInput={(e) => onChange({...card, route: e.detail.value})}
              />
            </View>
          </View>

          <View>
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="text-base text-muted-foreground">普通费用</Text>
              <View className="soft-chip px-3 py-1">
                <Text className="text-sm text-muted-foreground">{normalFeeItems.length} 项</Text>
              </View>
            </View>
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
            <View className="mt-2 rounded-xl border border-dashed border-primary/60 bg-primary/5 py-3 flex items-center justify-center" onClick={addFeeItem}>
              <Text className="text-base font-medium text-primary">+ 添加费用</Text>
            </View>
          </View>

          <View className="border-t border-border/60 pt-4">
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="text-base text-muted-foreground">其他费用</Text>
              <View className="soft-chip px-3 py-1">
                <Text className="text-sm text-muted-foreground">{otherFeeItems.length} 项</Text>
              </View>
            </View>
            <View className="flex flex-col gap-2">
              {otherFeeItems.map((item) => (
                <View key={item.id} className="flex flex-row items-center gap-2">
                  <View className="min-w-0 basis-3/5 rounded-xl border border-border bg-background px-3 py-3">
                    <Input
                      className="w-full text-lg text-foreground"
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
                  <View className="basis-2/5 rounded-xl border border-border bg-background px-3 py-3">
                    <Input
                      className="w-full text-lg text-right text-foreground"
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
            <View className="mt-2 rounded-xl border border-dashed border-emerald-500/60 bg-emerald-500/5 py-3 flex items-center justify-center" onClick={addOtherFeeItem}>
              <Text className="text-base font-medium text-emerald-600">+ 添加其他费用</Text>
            </View>
          </View>

          <View>
            <Text className="text-base text-muted-foreground mb-2 block">凭证图片（最多9张）</Text>
            <View className="flex flex-row flex-wrap gap-2">
              {card.receipt_images.map((img, index) => (
                <View key={img.path} className="relative h-20 w-20">
                  <Image
                    src={img.path}
                    className="h-full w-full rounded-lg"
                    mode="aspectFill"
                    onClick={() => previewImage(index)}
                  />
                  <View
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive flex items-center justify-center"
                    onClick={() => deleteImage(index)}>
                    <View className="i-mdi-close text-white text-sm" />
                  </View>
                </View>
              ))}
              {card.receipt_images.length < 9 && (
                <View
                  className="h-20 w-20 rounded-lg border border-dashed border-border bg-muted/50 flex flex-col items-center justify-center"
                  onClick={handleChooseImages}>
                  <View className="i-mdi-camera-plus text-muted-foreground text-2xl" />
                  <Text className="text-xs text-muted-foreground mt-1">上传</Text>
                </View>
              )}
            </View>
          </View>

          <View className="rounded-xl bg-primary/10 px-3 py-3 flex flex-row items-center justify-between">
            <Text className="text-base text-foreground font-medium">本车费用小计</Text>
            <Text className="text-xl font-bold text-primary">¥{card.total.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
