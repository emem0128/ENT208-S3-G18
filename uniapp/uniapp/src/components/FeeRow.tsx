// 费用行组件
import {Input, ScrollView, Text, View} from '@tarojs/components'
import {useState} from 'react'
import type {FeeItem, FeeType} from '@/db/types'

interface FeeRowProps {
  feeItem: FeeItem
  feeTypes: FeeType[]
  onChange: (feeItem: FeeItem) => void
  onDelete: () => void
}

export default function FeeRow({feeItem, feeTypes, onChange, onDelete}: FeeRowProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)

  const applyFeeType = (selectedType?: FeeType) => {
    if (!selectedType) return
    onChange({
      ...feeItem,
      field_name: selectedType.field_name,
      display_name: selectedType.display_name
    })
  }

  const handleAmountChange = (e: {detail: {value: string}}) => {
    const value = e.detail.value
    onChange({
      ...feeItem,
      amount: value ? Number.parseFloat(value) : 0
    })
  }

  const handleNoteChange = (e: {detail: {value: string}}) => {
    onChange({
      ...feeItem,
      note: e.detail.value
    })
  }

  const selectedIndex = feeTypes.findIndex((t) => t.field_name === feeItem.field_name)
  const selectedType = selectedIndex >= 0 ? feeTypes[selectedIndex] : null

  return (
    <>
      <View className="flex flex-col gap-2">
        <View className="flex flex-row items-center gap-2">
          <View className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3">
            <View
              onClick={() => setSelectorOpen(true)}>
              <Text className="text-xl text-foreground">{selectedType?.display_name || '选择费用类型'}</Text>
            </View>
          </View>
  
          <View className="w-28 shrink-0 rounded-xl border border-border bg-background px-3 py-3">
            <Input
              className="w-full text-lg text-right text-foreground"
              type="digit"
              placeholder="金额"
              value={feeItem.amount > 0 ? String(feeItem.amount) : ''}
              onInput={handleAmountChange}
            />
          </View>
  
          <View className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-destructive/10" onClick={onDelete}>
            <View className="i-mdi-close text-destructive text-2xl" />
          </View>
        </View>

        {feeItem.field_name && (
          <View className="rounded-xl border border-border bg-background px-3 py-3">
            <Text className="mb-2 block text-sm text-muted-foreground">地点/备注（选填）</Text>
            <Input
              className="w-full text-base text-foreground"
              placeholder="如：北投、桂福"
              value={feeItem.note || ''}
              onInput={handleNoteChange}
            />
          </View>
        )}
      </View>
      {selectorOpen && (
        <View className="fixed inset-0 z-50 flex flex-col justify-end">
          <View className="absolute inset-0 bg-black/45" onClick={() => setSelectorOpen(false)} />
          <View className="relative z-10 rounded-t-3xl bg-card px-5 pb-5 pt-4">
            <View className="mb-3 flex items-center justify-center">
              <View className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </View>
            <Text className="mb-4 block text-center text-xl font-semibold text-foreground">请选择费用类型</Text>
            <ScrollView
              scrollY
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background"
              style="max-height: 55vh">
              {feeTypes.map((type) => {
                const isActive = type.field_name === feeItem.field_name
                return (
                  <View
                    key={type.id}
                    className={`flex flex-row items-center justify-between px-4 ${
                      isActive ? 'bg-emerald-500/10' : 'bg-background'
                    }`}
                    style={{minHeight: '52px'}}
                    onClick={() => {
                      applyFeeType(type)
                      setSelectorOpen(false)
                    }}>
                    <Text className={`text-[18px] ${isActive ? 'font-semibold text-emerald-600' : 'text-foreground'}`}>
                      {type.display_name}
                    </Text>
                    <Text className={`text-xl ${isActive ? 'text-emerald-600' : 'text-transparent'}`}>✓</Text>
                  </View>
                )
              })}
            </ScrollView>
            <View
              className="mt-3 flex items-center justify-center rounded-2xl bg-muted py-4"
              onClick={() => setSelectorOpen(false)}>
              <Text className="text-lg font-medium text-foreground">取消</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
