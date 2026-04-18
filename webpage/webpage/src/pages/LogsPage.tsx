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

const LogsPage: React.FC = () => {
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
      toast.error('加载客服列表失败');
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
      toast.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  const getActionName = (action: string) => {
    const actionMap: Record<string, string> = {
      confirm: '确认报账',
      edit: '修改',
      create: '新增',
      update: '更新',
      delete: '删除',
    };
    return actionMap[action] || action;
  };

  const getTargetTypeName = (targetType: string) => {
    const typeMap: Record<string, string> = {
      expense_record: '报账记录',
      driver: '司机',
      vehicle: '车辆',
      advance_fund: '备用金',
      fee_type: '费用类型',
      staff: '客服账号',
    };
    return typeMap[targetType] || targetType;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">操作日志</h1>
          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>操作人</Label>
                <Select value={filters.operatorId || 'all'} onValueChange={(value) => setFilters({ ...filters, operatorId: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>操作类型</Label>
                <Select value={filters.action || 'all'} onValueChange={(value) => setFilters({ ...filters, action: value === 'all' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="confirm">确认报账</SelectItem>
                    <SelectItem value="edit">修改</SelectItem>
                    <SelectItem value="create">新增</SelectItem>
                    <SelectItem value="update">更新</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
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
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>对象</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        暂无数据
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
