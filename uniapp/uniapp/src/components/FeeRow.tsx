// 费用行组件
import {View, Text, Picker, Input} from '@tarojs/components'
import type {FeeItem, FeeType} from '@/db/types'

interface FeeRowProps {
  feeItem: FeeItem
  feeTypes: FeeType[]
  onChange: (feeItem: FeeItem) => void
  onDelete: () => void
}

export default function FeeRow({feeItem, feeTypes, onChange, onDelete}: FeeRowProps) {
  const handleTypeChange = (e: any) => {
    const index = e.detail.value
    const selectedType = feeTypes[index]
    onChange({
      ...feeItem,
      field_name: selectedType.field_name,
      display_name: selectedType.display_name
    })
  }

  const handleAmountChange = (e: any) => {
    const value = e.detail.value
    onChange({
      ...feeItem,
      amount: value ? Number.parseFloat(value) : 0
    })
  }

  const handleNoteChange = (e: any) => {
    onChange({
      ...feeItem,
      note: e.detail.value
    })
  }

  const selectedIndex = feeTypes.findIndex((t) => t.field_name === feeItem.field_name)

  return (
    <View className="flex flex-col space-y-2">
      <View className="flex flex-row items-center space-x-2">
        <Picker
          mode="selector"
          range={feeTypes}
          rangeKey="display_name"
          value={selectedIndex}
          onChange={handleTypeChange}>
          <View className="flex-1 bg-input rounded-xl border border-border px-4 py-4">
            <Text className="text-foreground text-xl">
              {feeItem.display_name || '选择费用类型'}
            </Text>
          </View>
        </Picker>

        <View className="w-32 bg-input rounded-xl border border-border px-4 py-4">
          <Input
            className="w-full text-foreground text-xl text-right"
            type="digit"
            placeholder="金额"
            value={feeItem.amount > 0 ? String(feeItem.amount) : ''}
            onInput={handleAmountChange}
          />
        </View>

        <View className="w-12 h-12 flex items-center justify-center" onClick={onDelete}>
          <View className="i-mdi-close-circle text-destructive text-3xl" />
        </View>
      </View>

      {feeItem.field_name === 'other' && (
        <View className="bg-input rounded-xl border border-border px-4 py-4">
          <Input
            className="w-full text-foreground text-xl"
            placeholder="请输入具体费用名称（必填）"
            value={feeItem.note || ''}
            onInput={handleNoteChange}
          />
        </View>
      )}

      {feeItem.field_name && feeItem.field_name !== 'other' && (
        <View className="bg-input rounded-xl border border-border px-4 py-3 ml-1">
          <Input
            className="w-full text-foreground text-lg"
            placeholder="备注地点/说明（选填，如：北投）"
            value={feeItem.note || ''}
            onInput={handleNoteChange}
          />
        </View>
      )}
    </View>
  )
}
