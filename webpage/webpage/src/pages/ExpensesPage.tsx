import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RefreshCw, Inbox } from 'lucide-react';
import { getExpenseRecords, getAllDrivers, confirmExpenseRecord, batchConfirmExpenseRecords, batchUpdateCommission, createOperationLog } from '@/db/api';
import type { ExpenseRecordWithDriver, Driver } from '@/types/database';
import { format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import EditExpenseDialog from '@/components/expenses/EditExpenseDialog';
import { useTranslation } from 'react-i18next';

const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<ExpenseRecordWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [batchCommissionDialogOpen, setBatchCommissionDialogOpen] = useState(false);
  const [batchCommission, setBatchCommission] = useState('');
  const [activeRecord, setActiveRecord] = useState<ExpenseRecordWithDriver | null>(null);

  // 筛选条件
  const [filters, setFilters] = useState({
    driverId: searchParams.get('driverId') || '',
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filters]);

  const loadDrivers = async () => {
    try {
      const driverList = await getAllDrivers(true);
      setDrivers(driverList);
    } catch (error) {
      console.error('加载司机列表失败:', error);
      toast.error(t('toast.loadDriversFailed'));
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await getExpenseRecords({
        driverId: filters.driverId ? Number(filters.driverId) : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status as 'pending' | 'confirmed' | undefined,
      });
      setRecords(data);
      setSelectedIds([]);
    } catch (error) {
      console.error('加载报账记录失败:', error);
      toast.error(t('toast.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSingle = async (id: number) => {
    if (!user) return;
    try {
      await confirmExpenseRecord(id, user.name);
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'confirm',
        target_type: 'expense_record',
        target_id: id,
        detail: '确认报账记录',
      });
      toast.success(t('toast.confirmSuccess'));
      setActiveRecord(null);
      loadRecords();
    } catch (error) {
      console.error('确认失败:', error);
      toast.error(t('toast.confirmFailed'));
    }
  };

  const handleBatchConfirm = async () => {
    if (!user || selectedIds.length === 0) return;
    try {
      await batchConfirmExpenseRecords(selectedIds, user.name);
      for (const id of selectedIds) {
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'confirm',
          target_type: 'expense_record',
          target_id: id,
          detail: '批量确认报账记录',
        });
      }
      toast.success(t('expenses.batchConfirmSuccess', { count: selectedIds.length }));
      setConfirmDialogOpen(false);
      loadRecords();
    } catch (error) {
      console.error('批量确认失败:', error);
      toast.error(t('expenses.batchConfirmFailed'));
    }
  };

  const handleBatchCommission = async () => {
    if (!user || selectedIds.length === 0) return;
    try {
      await batchUpdateCommission(selectedIds, Number(batchCommission));
      for (const id of selectedIds) {
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'edit',
          target_type: 'expense_record',
          target_id: id,
          detail: `批量填写提成：¥${batchCommission}`,
        });
      }
      toast.success(t('expenses.batchCommissionSuccess', { count: selectedIds.length }));
      setBatchCommissionDialogOpen(false);
      loadRecords();
    } catch (error) {
      console.error('批量填写提成失败:', error);
      toast.error(t('expenses.batchCommissionFailed'));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.filter(r => r.status === 'pending').length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.filter(r => r.status === 'pending').map(r => r.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const activeRecordIndex = activeRecord ? records.findIndex((item) => item.id === activeRecord.id) : -1;
  const hasPrevRecord = activeRecordIndex > 0;
  const hasNextRecord = activeRecordIndex >= 0 && activeRecordIndex < records.length - 1;

  const goPrevRecord = () => {
    if (!hasPrevRecord) return;
    setActiveRecord(records[activeRecordIndex - 1]);
  };

  const goNextRecord = () => {
    if (!hasNextRecord) return;
    setActiveRecord(records[activeRecordIndex + 1]);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('expenses.title')}</h1>
          <Button onClick={loadRecords} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card className="bg-muted/10 border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 min-w-[180px] flex-1">
                <Label>{t('common.driver')}</Label>
                <Select value={filters.driverId || 'all'} onValueChange={(value) => setFilters({ ...filters, driverId: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.allDrivers')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allDrivers')}</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id.toString()}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-[180px]">
                <Label>{t('common.startDate')}</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 min-w-[180px]">
                <Label>{t('common.endDate')}</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 min-w-[160px]">
                <Label>{t('common.status')}</Label>
                <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="pending">{t('common.pending')}</SelectItem>
                    <SelectItem value="confirmed">{t('common.confirmed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 批量操作按钮 */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('common.selectedCount', { count: selectedIds.length })}</span>
            <Button size="sm" onClick={() => setBatchCommissionDialogOpen(true)}>
              {t('expenses.batchCommission')}
            </Button>
            <Button size="sm" onClick={() => setConfirmDialogOpen(true)}>
              {t('expenses.batchConfirm')}
            </Button>
          </div>
        )}

        {/* 报账记录列表 */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <Table className="w-full table-auto text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9 px-1">
                      <Checkbox
                        checked={selectedIds.length === records.filter(r => r.status === 'pending').length && records.filter(r => r.status === 'pending').length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[86px] whitespace-nowrap px-1">{t('common.date')}</TableHead>
                    <TableHead className="w-[60px] whitespace-nowrap px-1">{t('common.driver')}</TableHead>
                    <TableHead className="w-[72px] whitespace-nowrap px-1">{t('vehicles.plateNumber')}</TableHead>
                    <TableHead className="w-[100px] px-1">{t('expenses.route')}</TableHead>
                    <TableHead className="w-[72px] whitespace-nowrap text-right px-1">{t('expenses.expense')}</TableHead>
                    <TableHead className="w-[64px] whitespace-nowrap text-right px-1">{t('expenses.commission')}</TableHead>
                    <TableHead className="w-[64px] whitespace-nowrap px-1">{t('common.status')}</TableHead>
                    <TableHead className="w-[78px] whitespace-nowrap px-1">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                          <span>{t('expenses.noRecords')}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record, index) => (
                      <TableRow
                        key={record.id}
                        className={index % 2 === 0 ? 'bg-muted/20' : ''}
                      >
                        <TableCell className="px-1">
                          {record.status === 'pending' && (
                            <Checkbox
                              checked={selectedIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-1">{format(new Date(record.record_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="px-1">{record.driver?.name}</TableCell>
                        <TableCell className="whitespace-nowrap px-1">{record.plate_number}</TableCell>
                        <TableCell className="break-all leading-5 px-1">{record.route || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap text-right px-1">¥{Number(record.total_expense).toFixed(2)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right px-1">¥{Number(record.commission).toFixed(2)}</TableCell>
                        <TableCell className="whitespace-nowrap px-1">
                          {record.status === 'pending' ? (
                            <Badge variant="outline" className="border-warning text-warning">
                              {t('common.pending')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success">
                              {t('common.confirmed')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setActiveRecord(record)}
                          >
                            {t('common.view')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 编辑对话框 */}
      <EditExpenseDialog
        open={!!activeRecord}
        onOpenChange={(open) => !open && setActiveRecord(null)}
        record={activeRecord}
        onSuccess={loadRecords}
        onConfirm={handleConfirmSingle}
        hasPrev={hasPrevRecord}
        hasNext={hasNextRecord}
        onPrev={goPrevRecord}
        onNext={goNextRecord}
      />

      {/* 批量确认对话框 */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('expenses.confirmDescription', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchConfirm}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量填提成对话框 */}
      <Dialog open={batchCommissionDialogOpen} onOpenChange={setBatchCommissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('expenses.batchCommissionTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('expenses.commissionAmount')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={t('expenses.commissionPlaceholder')}
                value={batchCommission}
                onChange={(e) => setBatchCommission(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {t('expenses.batchCommissionHint', { count: selectedIds.length })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCommissionDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBatchCommission}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ExpensesPage;
