import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ExpenseRecordWithDriver, FeeType, OtherFeeItem } from '@/types/database';
import {
  getAllFeeTypes,
  getAllVehicles,
  updateExpenseRecord,
  createOperationLog,
  fetchOtherFees,
} from '@/db/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ExpenseRecordWithDriver | null;
  onSuccess: () => void;
  onConfirm?: (id: number) => Promise<void>;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

const EditExpenseDialog: React.FC<EditExpenseDialogProps> = ({
  open,
  onOpenChange,
  record,
  onSuccess,
  onConfirm,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [feeDetails, setFeeDetails] = useState<Record<string, string>>({});
  const [otherFees, setOtherFees] = useState<OtherFeeItem[]>([]);
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null);
  
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
    fee_location_detail: '',
    commission: 0,
    is_overtime: false,
  });

  const createEmptyOtherFee = (): OtherFeeItem => ({
    name: '',
    amount: 0,
    sort_order: otherFees.length,
  });

  const splitLegacyMixedNoteDetail = (raw: string, names: string[]) => {
    const parts = raw
      .split(/[;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const feeParts: string[] = [];
    const otherParts: string[] = [];
    for (const part of parts) {
      const isFeePart = names.some((name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escaped}\\s*\\([^)]*\\)\\s*[:：]`);
        return pattern.test(part);
      });
      if (isFeePart) {
        feeParts.push(part);
      } else {
        otherParts.push(part);
      }
    }
    return {
      otherName: otherParts.join('; '),
      feeLocationDetail: feeParts.join('; '),
    };
  };

  const parseLegacyMetaPayload = (raw?: string) => {
    if (!raw || !raw.startsWith('__FEE_META__:')) return null;
    try {
      const parsed = JSON.parse(raw.slice('__FEE_META__:'.length)) as {
        otherName?: string;
        feeDetails?: Record<string, string>;
      };
      return {
        otherName: parsed.otherName || '',
        feeDetails: parsed.feeDetails || {},
      };
    } catch {
      return null;
    }
  };

  const parseLegacyOtherFees = (raw?: string | null) => {
    if (!raw) return [];
    return raw
      .split(/[;；]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item, index) => {
        const normalized = item.replace('：', ':');
        const match = normalized.match(/^(.+?):\s*(-?\d+(\.\d+)?)$/);
        if (!match) return null;
        return {
          name: match[1].trim(),
          amount: Number(match[2]) || 0,
          sort_order: index,
        } as OtherFeeItem;
      })
      .filter((item): item is OtherFeeItem => !!item && !!item.name);
  };

  const parseFeeLocationDetailToMap = (raw: string, types: FeeType[]) => {
    const result: Record<string, string> = {};
    if (!raw) return result;
    for (const feeType of types) {
      const escaped = feeType.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${escaped}\\((.*?)\\):\\s*([^;；]+)`, 'g');
      const parts: string[] = [];
      let match: RegExpExecArray | null = pattern.exec(raw);
      while (match) {
        const location = (match[1] || '').trim();
        const amount = (match[2] || '').trim();
        if (location) {
          parts.push(amount ? `${location}:${amount}` : location);
        }
        match = pattern.exec(raw);
      }
      if (parts.length > 0) {
        result[feeType.field_name] = parts.join(', ');
      }
    }
    return result;
  };

  const parseFeeEntriesText = (raw: string, fallbackAmount: number) => {
    return raw
      .split(/[，,;]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((entry) => {
        const normalized = entry.replace('：', ':');
        const idx = normalized.indexOf(':');
        if (idx === -1) {
          return {
            location: normalized,
            amountText: String(fallbackAmount),
          };
        }
        return {
          location: normalized.slice(0, idx).trim(),
          amountText: normalized.slice(idx + 1).trim(),
        };
      })
      .filter((item) => item.location);
  };

  const buildFeeLocationDetail = (types: FeeType[]) => {
    const segments = types.flatMap((feeType) => {
      const locationText = (feeDetails[feeType.field_name] || '').trim();
      if (!locationText) return [];
      const amount = Number(formData[feeType.field_name as keyof typeof formData] as number) || 0;
      const entries = parseFeeEntriesText(locationText, amount);
      return entries.map((entry) => `${feeType.display_name}(${entry.location}):${entry.amountText}`);
    });
    return segments.join('; ');
  };

  useEffect(() => {
    if (open && record) {
      let feeLocationDetail = record.fee_location_detail || '';
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
        fee_location_detail: feeLocationDetail,
        commission: Number(record.commission),
        is_overtime: record.is_overtime,
      });
      setFeeDetails({});
      setOtherFees([]);
      setIsEditing(false);
      loadFeeTypes();
      loadVehicles();
    }
  }, [open, record]);

  useEffect(() => {
    if (!open || !record || feeTypes.length === 0) return;

    const feeNames = feeTypes.map((item) => item.display_name);
    const metaPayload = parseLegacyMetaPayload(record.note_detail || '');
    let otherName = metaPayload?.otherName || record.note_detail || '';
    let feeLocationDetail = record.fee_location_detail || '';

    if (otherName) {
      const split = splitLegacyMixedNoteDetail(otherName, feeNames);
      otherName = split.otherName;
      if (split.feeLocationDetail) {
        feeLocationDetail = feeLocationDetail
          ? `${feeLocationDetail}; ${split.feeLocationDetail}`
          : split.feeLocationDetail;
      }
    }

    setFormData((prev) => ({
      ...prev,
      note_detail: otherName,
      fee_location_detail: feeLocationDetail,
    }));

    const loadOtherFeesData = async () => {
      try {
        const rows = await fetchOtherFees(record.id);
        if (rows.length > 0) {
          setOtherFees(rows);
          return;
        }
      } catch (error) {
        console.error('加载其他费用失败:', error);
      }

      const fallbackOtherFees = parseLegacyOtherFees(otherName);
      setOtherFees(
        fallbackOtherFees.length > 0
          ? fallbackOtherFees
          : Number(record.note_amount) > 0
            ? [{ name: otherName, amount: Number(record.note_amount), sort_order: 0 }]
            : []
      );
    };

    loadOtherFeesData();

    if (metaPayload?.feeDetails && Object.keys(metaPayload.feeDetails).length > 0 && !feeLocationDetail) {
      setFeeDetails(metaPayload.feeDetails);
      return;
    }

    setFeeDetails(parseFeeLocationDetailToMap(feeLocationDetail, feeTypes));
  }, [open, record, feeTypes]);

  useEffect(() => {
    if (!open || !record) return;
    dialogContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [record?.id, open]);

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
    const otherFeeTotal = otherFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
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
      otherFeeTotal
    );
  };

  const handleSubmit = async () => {
    if (!record || !user) return;

    setLoading(true);
    try {
      const normalizedOtherFees = otherFees
        .map((item, index) => ({
          ...item,
          name: item.name?.trim() || '',
          amount: Number(item.amount) || 0,
          sort_order: index,
        }))
        .filter((item) => item.name && item.amount > 0);
      const totalExpense = calculateTotalExpense();
      const nextFeeLocationDetail = buildFeeLocationDetail(feeTypes);
      await updateExpenseRecord(record.id, {
        ...formData,
        note_amount: normalizedOtherFees.reduce((sum, item) => sum + item.amount, 0),
        note_detail: normalizedOtherFees.map((item) => `${item.name}:${item.amount}`).join('; '),
        fee_location_detail: nextFeeLocationDetail,
        other_fees: normalizedOtherFees,
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

      toast.success(t('toast.updateSuccess'));
      onSuccess();
      setIsEditing(false);
      onOpenChange(false);
    } catch (error) {
      console.error('修改失败:', error);
      toast.error(t('toast.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommission = async () => {
    if (!record || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expense_records')
        .update({ commission: formData.commission })
        .eq('id', record.id);

      if (error) {
        throw error;
      }

      toast.success(t('editExpense.commissionSaved'));
      onSuccess();
    } catch (error) {
      console.error('提成保存失败:', error);
      toast.error(t('toast.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef} className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editExpense.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">{t('common.date')}</Label>
              <Input value={format(new Date(record.record_date), 'yyyy-MM-dd')} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">{t('common.driver')}</Label>
              <Input value={record.driver?.name || '-'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('vehicles.plateNumber')}</Label>
              <Select value={formData.plate_number} onValueChange={(value) => setFormData({ ...formData, plate_number: value })} disabled={!isEditing}>
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
              <Label>{t('expenses.route')}</Label>
              <Input
                value={formData.route}
                disabled={!isEditing}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('editExpense.feeDetails')}</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-[140px_120px_minmax(0,1fr)] items-center gap-3 text-xs text-muted-foreground">
                <div>{t('editExpense.feeName')}</div>
                <div>{t('editExpense.feeAmount')}</div>
                <div>{t('editExpense.feeDetail')}</div>
              </div>
              {feeTypes.map((feeType) => (
                <div key={feeType.id} className="grid grid-cols-[140px_120px_minmax(0,1fr)] items-center gap-3">
                  <Label className="text-sm">{feeType.display_name}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    disabled={!isEditing}
                    value={formData[feeType.field_name as keyof typeof formData] as number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [feeType.field_name]: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    value={feeDetails[feeType.field_name] || ''}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setFeeDetails((prev) => ({
                        ...prev,
                        [feeType.field_name]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t('editExpense.otherFees')}</Label>
              <div className="text-sm text-muted-foreground">
                {t('editExpense.otherFeesTotal', { amount: otherFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2) })}
              </div>
            </div>
            {otherFees.length === 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {t('editExpense.noOtherFees')}
              </div>
            )}
            {otherFees.map((item, index) => (
              <div key={`${item.id || 'new'}_${index}`} className="grid grid-cols-[minmax(0,1fr)_140px_auto] gap-3">
                <Input
                  value={item.name}
                  disabled={!isEditing}
                  placeholder={t('editExpense.otherFeeName')}
                  onChange={(e) =>
                    setOtherFees((prev) =>
                      prev.map((fee, feeIndex) =>
                        feeIndex === index ? { ...fee, name: e.target.value } : fee
                      )
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isEditing}
                  value={item.amount}
                  placeholder={t('common.amount')}
                  onChange={(e) =>
                    setOtherFees((prev) =>
                      prev.map((fee, feeIndex) =>
                        feeIndex === index ? { ...fee, amount: Number(e.target.value) || 0 } : fee
                      )
                    )
                  }
                />
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOtherFees((prev) => prev.filter((_, feeIndex) => feeIndex !== index))}
                  >
                    {t('common.delete')}
                  </Button>
                )}
              </div>
            ))}
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setOtherFees((prev) => [...prev, { ...createEmptyOtherFee(), sort_order: prev.length }])}
              >
                {t('editExpense.addOtherFee')}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('expenses.commission')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={t('expenses.commissionPlaceholder')}
              value={formData.commission || ''}
              onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_overtime}
              disabled={!isEditing}
              onCheckedChange={(checked) => setFormData({ ...formData, is_overtime: checked })}
            />
            <Label>{t('common.overtime')}</Label>
          </div>

          {record.receipt_images && record.receipt_images.length > 0 && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">{t('editExpense.billImages')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {record.receipt_images.map((url: string, index: number) => (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={t('editExpense.billImageAlt', { index: index + 1 })}
                      className="w-full rounded border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ maxHeight: '200px' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">{t('editExpense.totalExpense')}</div>
            <div className="text-2xl font-bold">¥{calculateTotalExpense().toFixed(2)}</div>
          </div>
        </div>
        <DialogFooter>
          <div className="mr-auto flex items-center gap-2">
            <Button variant="outline" onClick={onPrev} disabled={!hasPrev || loading}>
              {t('editExpense.previous')}
            </Button>
            <Button variant="outline" onClick={onNext} disabled={!hasNext || loading}>
              {t('editExpense.next')}
            </Button>
          </div>
          {record.status === 'pending' && !isEditing && onConfirm && (
            <Button onClick={() => onConfirm(record.id)} disabled={loading}>
              {t('common.confirm')}
            </Button>
          )}
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)} disabled={loading}>
              {t('common.edit')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
              {t('editExpense.cancelEdit')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button onClick={isEditing ? handleSubmit : handleSaveCommission} loading={loading} loadingText={t('common.saveLoading')}>
            {isEditing ? t('common.save') : t('editExpense.saveCommission')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditExpenseDialog;
