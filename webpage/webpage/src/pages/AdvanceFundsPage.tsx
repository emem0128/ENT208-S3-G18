import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { getAdvanceFundStats, getAllDrivers, getAdvanceFundRecords, createAdvanceFundRecord, deleteAdvanceFundRecord, createOperationLog } from '@/db/api';
import type { AdvanceFundStats, Driver, AdvanceFundRecordWithDriver } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const AdvanceFundsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdvanceFundStats[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [driverId, setDriverId] = useState('');
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [detailRecords, setDetailRecords] = useState<AdvanceFundRecordWithDriver[]>([]);
  const [deleteRecord, setDeleteRecord] = useState<AdvanceFundRecordWithDriver | null>(null);
  const [rechargeForm, setRechargeForm] = useState({
    amount: '',
    fund_date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    loadStats();
  }, [month, driverId]);

  const loadDrivers = async () => {
    try {
      const driverList = await getAllDrivers(true);
      setDrivers(driverList);
    } catch (error) {
      console.error('加载司机列表失败:', error);
      toast.error(t('toast.loadDriversFailed'));
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getAdvanceFundStats(month);
      if (driverId) {
        setStats(data.filter(s => s.driver_id === Number(driverId)));
      } else {
        setStats(data);
      }
    } catch (error) {
      console.error('加载备用金数据失败:', error);
      toast.error(t('advanceFunds.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRechargeDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setRechargeForm({
      amount: '',
      fund_date: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    });
    setRechargeDialogOpen(true);
  };

  const handleRecharge = async () => {
    if (!user || !selectedDriver) return;

    if (!rechargeForm.amount || Number(rechargeForm.amount) <= 0) {
      toast.error(t('advanceFunds.invalidAmount'));
      return;
    }

    try {
      const fundDate = new Date(rechargeForm.fund_date);
      const rechargeMonth = format(fundDate, 'yyyy-MM');

      const newRecord = await createAdvanceFundRecord({
        driver_id: selectedDriver.id,
        amount: Number(rechargeForm.amount),
        fund_date: rechargeForm.fund_date,
        month: rechargeMonth,
        note: rechargeForm.note || undefined,
      });

      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'create',
        target_type: 'advance_fund',
        target_id: newRecord.id,
        detail: `为 ${selectedDriver.name} 充值备用金 ¥${rechargeForm.amount}`,
      });

      toast.success(t('advanceFunds.rechargeSuccess'));
      setRechargeDialogOpen(false);
      loadStats();
    } catch (error) {
      console.error('充值失败:', error);
      toast.error(t('advanceFunds.rechargeFailed'));
    }
  };

  const handleOpenDetailDialog = async (driver: Driver) => {
    setSelectedDriver(driver);
    try {
      const records = await getAdvanceFundRecords({
        driverId: driver.id,
        month: month,
      });
      setDetailRecords(records);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error('加载明细失败:', error);
      toast.error(t('advanceFunds.loadDetailFailed'));
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteRecord) return;

    try {
      await deleteAdvanceFundRecord(deleteRecord.id);
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'delete',
        target_type: 'advance_fund',
        target_id: deleteRecord.id,
        detail: `删除备用金充值记录：¥${deleteRecord.amount}`,
      });

      toast.success(t('toast.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeleteRecord(null);
      
      // 重新加载明细
      if (selectedDriver) {
        const records = await getAdvanceFundRecords({
          driverId: selectedDriver.id,
          month: month,
        });
        setDetailRecords(records);
      }
      
      loadStats();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error(t('toast.deleteFailed'));
    }
  };

  const getDetailStats = () => {
    const totalRecharge = detailRecords.reduce((sum, r) => sum + Number(r.amount), 0);
    const stat = stats.find(s => s.driver_id === selectedDriver?.id);
    const totalExpense = stat?.total_expense || 0;
    const balance = totalRecharge - totalExpense;

    return { totalRecharge, totalExpense, balance };
  };

  const getMonthRange = () => {
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    return { monthStart, monthEnd };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('advanceFunds.title')}</h1>
          <Button onClick={loadStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.month')}</Label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.driver')}</Label>
                <Select value={driverId || 'all'} onValueChange={(value) => setDriverId(value === 'all' ? '' : value)}>
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
            </div>
          </CardContent>
        </Card>

        {/* 各司机备用金概览表格 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('advanceFunds.overview')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.driver')}</TableHead>
                    <TableHead className="text-right">{t('advanceFunds.rechargeTotal')}</TableHead>
                    <TableHead className="text-right">{t('advanceFunds.confirmedExpense')}</TableHead>
                    <TableHead className="text-right">{t('advanceFunds.balance')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((stat) => {
                      const driver = drivers.find(d => d.id === stat.driver_id);
                      if (!driver) return null;
                      return (
                        <TableRow key={stat.driver_id}>
                          <TableCell className="font-medium">{stat.driver_name}</TableCell>
                          <TableCell className="text-right">¥{stat.total_recharge.toFixed(2)}</TableCell>
                          <TableCell className="text-right">¥{stat.total_expense.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ¥{stat.balance.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenRechargeDialog(driver)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                {t('advanceFunds.recharge')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenDetailDialog(driver)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {t('common.details')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 充值对话框 */}
      <Dialog open={rechargeDialogOpen} onOpenChange={setRechargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('advanceFunds.rechargeDialog', { name: selectedDriver?.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('advanceFunds.rechargeAmount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={rechargeForm.amount}
                onChange={(e) => setRechargeForm({ ...rechargeForm, amount: e.target.value })}
                placeholder={t('advanceFunds.inputRechargeAmount')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('advanceFunds.rechargeDate')}</Label>
              <Input
                type="date"
                value={rechargeForm.fund_date}
                onChange={(e) => setRechargeForm({ ...rechargeForm, fund_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.optionalRemarks')}</Label>
              <Input
                value={rechargeForm.note}
                onChange={(e) => setRechargeForm({ ...rechargeForm, note: e.target.value })}
                placeholder={t('common.remarks')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRecharge}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 明细对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('advanceFunds.detailDialog', { name: selectedDriver?.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead className="text-right">{t('common.amount')}</TableHead>
                  <TableHead>{t('common.remarks')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('advanceFunds.noRechargeRecords')}
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.fund_date), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>{t('advanceFunds.recharge')}</TableCell>
                      <TableCell className="text-right">¥{Number(record.amount).toFixed(2)}</TableCell>
                      <TableCell>{record.note || '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteRecord(record);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('common.delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">{t('advanceFunds.rechargeTotal')}：</span>
                <span className="font-bold">¥{getDetailStats().totalRecharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">
                  {t('advanceFunds.expenseConfirmedInRange', getMonthRange())}
                </span>
                <span className="font-bold">¥{getDetailStats().totalExpense.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold">{t('advanceFunds.balance')}：</span>
                <span className="font-bold text-primary">¥{getDetailStats().balance.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('advanceFunds.deleteDescription', { amount: deleteRecord?.amount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default AdvanceFundsPage;
