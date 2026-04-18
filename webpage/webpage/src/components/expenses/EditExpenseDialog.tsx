import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ExpenseRecordWithDriver, FeeType } from '@/types/database';
import { getAllFeeTypes, getAllVehicles, updateExpenseRecord, createOperationLog } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ExpenseRecordWithDriver | null;
  onSuccess: () => void;
}

const EditExpenseDialog: React.FC<EditExpenseDialogProps> = ({
  open,
  onOpenChange,
  record,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    plate_number: '',
    route: '',
    fee_weighing: 0,
    fee_container: 0,
    fee_overnight: 0,
    fee_vn_overtime: 0,
    fee_vn_key: 0,
    fee_parking: 0,
    fee_newpost: 0,
    fee_taxi: 0,
    fee_water: 0,
    fee_tarpaulin: 0,
    fee_highway: 0,
    fee_stamp: 0,
    note_amount: 0,
    note_detail: '',
    commission: 0,
    is_overtime: false,
  });

  useEffect(() => {
    if (open && record) {
      setFormData({
        plate_number: record.plate_number,
        route: record.route || '',
        fee_weighing: Number(record.fee_weighing),
        fee_container: Number(record.fee_container),
        fee_overnight: Number(record.fee_overnight),
        fee_vn_overtime: Number(record.fee_vn_overtime),
        fee_vn_key: Number(record.fee_vn_key),
        fee_parking: Number(record.fee_parking),
        fee_newpost: Number(record.fee_newpost),
        fee_taxi: Number(record.fee_taxi),
        fee_water: Number(record.fee_water),
        fee_tarpaulin: Number(record.fee_tarpaulin),
        fee_highway: Number(record.fee_highway),
        fee_stamp: Number(record.fee_stamp),
        note_amount: Number(record.note_amount),
        note_detail: record.note_detail || '',
        commission: Number(record.commission),
        is_overtime: record.is_overtime,
      });
      loadFeeTypes();
      loadVehicles();
    }
  }, [open, record]);

  const loadFeeTypes = async () => {
    try {
      const types = await getAllFeeTypes(true);
      setFeeTypes(types.filter(t => t.field_name !== 'other'));
    } catch (error) {
      console.error('加载费用类型失败:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const vehicleList = await getAllVehicles(true);
      setVehicles(vehicleList.map(v => v.plate_number));
    } catch (error) {
      console.error('加载车辆列表失败:', error);
    }
  };

  const calculateTotalExpense = () => {
    return (
      formData.fee_weighing +
      formData.fee_container +
      formData.fee_overnight +
      formData.fee_vn_overtime +
      formData.fee_vn_key +
      formData.fee_parking +
      formData.fee_newpost +
      formData.fee_taxi +
      formData.fee_water +
      formData.fee_tarpaulin +
      formData.fee_highway +
      formData.fee_stamp +
      formData.note_amount
    );
  };

  const handleSubmit = async () => {
    if (!record || !user) return;

    setLoading(true);
    try {
      const totalExpense = calculateTotalExpense();
      await updateExpenseRecord(record.id, {
        ...formData,
        total_expense: totalExpense,
      });

      // 记录操作日志
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'edit',
        target_type: 'expense_record',
        target_id: record.id,
        detail: `修改报账记录，总支出从 ¥${record.total_expense} 改为 ¥${totalExpense}`,
      });

      toast.success('修改成功');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('修改失败:', error);
      toast.error('修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑报账记录</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>车牌号</Label>
              <Select value={formData.plate_number} onValueChange={(value) => setFormData({ ...formData, plate_number: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((plate) => (
                    <SelectItem key={plate} value={plate}>
                      {plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>路线/地点</Label>
              <Input
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">费用明细</Label>
            <div className="grid grid-cols-3 gap-3">
              {feeTypes.map((feeType) => (
                <div key={feeType.id} className="space-y-1">
                  <Label className="text-sm">{feeType.display_name}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData[feeType.field_name as keyof typeof formData] as number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [feeType.field_name]: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>其他费用金额</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.note_amount}
                onChange={(e) => setFormData({ ...formData, note_amount: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>其他费用说明</Label>
              <Input
                value={formData.note_detail}
                onChange={(e) => setFormData({ ...formData, note_detail: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>提成</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="请输入提成金额"
              value={formData.commission || ''}
              onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_overtime}
              onCheckedChange={(checked) => setFormData({ ...formData, is_overtime: checked })}
            />
            <Label>加班</Label>
          </div>

          {record.receipt_images && record.receipt_images.length > 0 && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">账单图片</Label>
              <div className="grid grid-cols-2 gap-2">
                {record.receipt_images.map((url: string, index: number) => (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`账单图片 ${index + 1}`}
                      className="w-full rounded border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ maxHeight: '200px' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">支出合计</div>
            <div className="text-2xl font-bold">¥{calculateTotalExpense().toFixed(2)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={loading} loadingText="保存中...">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditExpenseDialog;
