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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Eye, Edit, Check, RefreshCw, Inbox } from 'lucide-react';
import { getExpenseRecords, getAllDrivers, confirmExpenseRecord, batchConfirmExpenseRecords, batchUpdateCommission, createOperationLog } from '@/db/api';
import type { ExpenseRecordWithDriver, Driver } from '@/types/database';
import { format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import EditExpenseDialog from '@/components/expenses/EditExpenseDialog';

const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<ExpenseRecordWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [batchCommissionDialogOpen, setBatchCommissionDialogOpen] = useState(false);
  const [batchCommission, setBatchCommission] = useState('');
  const [editRecord, setEditRecord] = useState<ExpenseRecordWithDriver | null>(null);
  const [viewRecord, setViewRecord] = useState<ExpenseRecordWithDriver | null>(null);

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
      toast.error('加载司机列表失败');
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
      toast.error('加载报账记录失败');
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
      toast.success('确认成功');
      loadRecords();
    } catch (error) {
      console.error('确认失败:', error);
      toast.error('确认失败，请重试');
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
      toast.success(`成功确认 ${selectedIds.length} 条记录`);
      setConfirmDialogOpen(false);
      loadRecords();
    } catch (error) {
      console.error('批量确认失败:', error);
      toast.error('批量确认失败，请重试');
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
      toast.success(`成功填写 ${selectedIds.length} 条记录的提成`);
      setBatchCommissionDialogOpen(false);
      loadRecords();
    } catch (error) {
      console.error('批量填写提成失败:', error);
      toast.error('批量填写提成失败，请重试');
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

  const getFeeDetails = (record: ExpenseRecordWithDriver) => {
    const fees = [];
    if (record.fee_weighing > 0) fees.push(`过磅费${record.fee_weighing}`);
    if (record.fee_container > 0) fees.push(`提柜费${record.fee_container}`);
    if (record.fee_overnight > 0) fees.push(`过夜费${record.fee_overnight}`);
    if (record.fee_vn_overtime > 0) fees.push(`越南超时费${record.fee_vn_overtime}`);
    if (record.fee_vn_key > 0) fees.push(`越南收钥匙${record.fee_vn_key}`);
    if (record.fee_parking > 0) fees.push(`停车费${record.fee_parking}`);
    if (record.fee_newpost > 0) fees.push(`新岗${record.fee_newpost}`);
    if (record.fee_taxi > 0) fees.push(`打车${record.fee_taxi}`);
    if (record.fee_water > 0) fees.push(`淋水${record.fee_water}`);
    if (record.fee_tarpaulin > 0) fees.push(`解篷布${record.fee_tarpaulin}`);
    if (record.fee_highway > 0) fees.push(`高速费${record.fee_highway}`);
    if (record.fee_stamp > 0) fees.push(`盖章${record.fee_stamp}`);
    return fees.join(' + ') || '-';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">报账管理</h1>
          <Button onClick={loadRecords} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card className="bg-muted/10 border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 min-w-[180px] flex-1">
                <Label>司机</Label>
                <Select value={filters.driverId || 'all'} onValueChange={(value) => setFilters({ ...filters, driverId: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部司机" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部司机</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id.toString()}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-[180px]">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 min-w-[180px]">
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 min-w-[160px]">
                <Label>状态</Label>
                <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="pending">待确认</SelectItem>
                    <SelectItem value="confirmed">已确认</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 批量操作按钮 */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">已选择 {selectedIds.length} 条</span>
            <Button size="sm" onClick={() => setBatchCommissionDialogOpen(true)}>
              批量填提成
            </Button>
            <Button size="sm" onClick={() => setConfirmDialogOpen(true)}>
              批量确认
            </Button>
          </div>
        )}

        {/* 报账记录列表 */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === records.filter(r => r.status === 'pending').length && records.filter(r => r.status === 'pending').length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>司机</TableHead>
                    <TableHead>车牌号</TableHead>
                    <TableHead>路线/地点</TableHead>
                    <TableHead>费用明细</TableHead>
                    <TableHead>其他费用</TableHead>
                    <TableHead className="text-right">支出合计</TableHead>
                    <TableHead className="text-right">提成</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                          <span>暂无报账记录</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record, index) => (
                      <TableRow
                        key={record.id}
                        className={index % 2 === 0 ? 'bg-muted/20' : ''}
                      >
                        <TableCell>
                          {record.status === 'pending' && (
                            <Checkbox
                              checked={selectedIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(record.record_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>{record.driver?.name}</TableCell>
                        <TableCell>{record.plate_number}</TableCell>
                        <TableCell>{record.route || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{getFeeDetails(record)}</TableCell>
                        <TableCell>
                          {record.note_amount > 0 ? `¥${record.note_amount} ${record.note_detail || ''}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">¥{Number(record.total_expense).toFixed(2)}</TableCell>
                        <TableCell className="text-right">¥{Number(record.commission).toFixed(2)}</TableCell>
                        <TableCell>
                          {record.status === 'pending' ? (
                            <Badge variant="outline" className="border-warning text-warning">
                              待确认
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success">
                              已确认
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {record.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleConfirmSingle(record.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  确认
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditRecord(record)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  编辑
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewRecord(record)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                查看
                              </Button>
                            )}
                          </div>
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
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(null)}
        record={editRecord}
        onSuccess={loadRecords}
      />

      {/* 查看对话框 */}
      <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>查看报账记录</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">日期</div>
                  <div className="font-medium">{format(new Date(viewRecord.record_date), 'yyyy-MM-dd')}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">司机</div>
                  <div className="font-medium">{viewRecord.driver?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">车牌号</div>
                  <div className="font-medium">{viewRecord.plate_number}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">路线/地点</div>
                  <div className="font-medium">{viewRecord.route || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">费用明细</div>
                <div className="text-sm">{getFeeDetails(viewRecord)}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">支出合计</div>
                  <div className="font-medium">¥{Number(viewRecord.total_expense).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">提成</div>
                  <div className="font-medium">¥{Number(viewRecord.commission).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">加班</div>
                  <div className="font-medium">{viewRecord.is_overtime ? '是' : '否'}</div>
                </div>
              </div>
              {viewRecord.receipt_images && viewRecord.receipt_images.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">账单图片</div>
                  <div className="grid grid-cols-2 gap-2">
                    {viewRecord.receipt_images.map((url: string, index: number) => (
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
              <div>
                <div className="text-sm text-muted-foreground">确认信息</div>
                <div className="text-sm">
                  {viewRecord.confirmed_by} 于 {viewRecord.confirmed_at ? format(new Date(viewRecord.confirmed_at), 'yyyy-MM-dd HH:mm') : '-'} 确认
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewRecord(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量确认对话框 */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
            <AlertDialogDescription>
              确定要确认选中的 {selectedIds.length} 条报账记录吗？确认后将无法修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchConfirm}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量填提成对话框 */}
      <Dialog open={batchCommissionDialogOpen} onOpenChange={setBatchCommissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量填写提成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>提成金额</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="请输入提成金额"
                value={batchCommission}
                onChange={(e) => setBatchCommission(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              将为选中的 {selectedIds.length} 条记录填写提成
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCommissionDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchCommission}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ExpensesPage;
