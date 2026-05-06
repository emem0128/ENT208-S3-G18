import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import { getOperationLogs, getAllServiceStaff } from '@/db/api';
import type { OperationLog, ServiceStaff } from '@/types/database';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [staff, setStaff] = useState<ServiceStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    operatorId: '',
    action: '',
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadStaff = async () => {
    try {
      const data = await getAllServiceStaff();
      setStaff(data);
    } catch (error) {
      console.error('加载客服列表失败:', error);
      toast.error(t('toast.loadStaffFailed'));
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getOperationLogs({
        operatorId: filters.operatorId ? Number(filters.operatorId) : undefined,
        action: filters.action || undefined,
        startDate: `${filters.startDate}T00:00:00`,
        endDate: `${filters.endDate}T23:59:59`,
        limit: 100,
      });
      setLogs(data);
    } catch (error) {
      console.error('加载操作日志失败:', error);
      toast.error(t('toast.loadLogsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getActionName = (action: string) => {
    const actionMap: Record<string, string> = {
      confirm: t('logs.actions.confirm'),
      edit: t('logs.actions.edit'),
      create: t('logs.actions.create'),
      update: t('logs.actions.update'),
      delete: t('logs.actions.delete'),
    };
    return actionMap[action] || action;
  };

  const getTargetTypeName = (targetType: string) => {
    const typeMap: Record<string, string> = {
      expense_record: t('logs.targets.expense_record'),
      driver: t('logs.targets.driver'),
      vehicle: t('logs.targets.vehicle'),
      advance_fund: t('logs.targets.advance_fund'),
      fee_type: t('logs.targets.fee_type'),
      staff: t('logs.targets.staff'),
    };
    return typeMap[targetType] || targetType;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('logs.title')}</h1>
          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('logs.operator')}</Label>
                <Select value={filters.operatorId || 'all'} onValueChange={(value) => setFilters({ ...filters, operatorId: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('logs.actionType')}</Label>
                <Select value={filters.action || 'all'} onValueChange={(value) => setFilters({ ...filters, action: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="confirm">{t('logs.actions.confirm')}</SelectItem>
                    <SelectItem value="edit">{t('logs.actions.edit')}</SelectItem>
                    <SelectItem value="create">{t('logs.actions.create')}</SelectItem>
                    <SelectItem value="update">{t('logs.actions.update')}</SelectItem>
                    <SelectItem value="delete">{t('logs.actions.delete')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('common.startDate')}</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.endDate')}</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日志列表 */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('logs.time')}</TableHead>
                    <TableHead>{t('logs.operator')}</TableHead>
                    <TableHead>{t('logs.action')}</TableHead>
                    <TableHead>{t('logs.target')}</TableHead>
                    <TableHead>{t('logs.detail')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                        <TableCell>{log.operator_name}</TableCell>
                        <TableCell>{getActionName(log.action)}</TableCell>
                        <TableCell>
                          {getTargetTypeName(log.target_type)} #{log.target_id}
                        </TableCell>
                        <TableCell className="max-w-md truncate">{log.detail || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default LogsPage;
