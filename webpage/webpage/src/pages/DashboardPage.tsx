import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getDashboardStats, getDriverMonthStats } from '@/db/api';
import type { DashboardStats, DriverMonthStats } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [driverStats, setDriverStats] = useState<DriverMonthStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const today = format(new Date(), 'yyyy-MM-dd');
  const isCurrentMonth = selectedMonth === format(new Date(), 'yyyy-MM');

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardData, driverData] = await Promise.all([
        getDashboardStats(today, selectedMonth),
        getDriverMonthStats(selectedMonth),
      ]);
      setStats(dashboardData);
      setDriverStats(driverData);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error(t('toast.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleDriverClick = (driverId: number) => {
    navigate(`/expenses?driverId=${driverId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 顶部信息栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.currentDate', { date: format(new Date(), 'yyyy年MM月dd日') })}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>{t('dashboard.viewMonth')}</Label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refreshData')}
            </Button>
          </div>
        </div>

        {/* 今日概况卡片组 - 只在当前月份显示 */}
        {isCurrentMonth && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  {t('dashboard.todayNew')}
                  <FileText className="h-4 w-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats?.todayNew || 0}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  {t('dashboard.todayPending')}
                  <Clock className="h-4 w-4 text-warning" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats?.todayPending || 0}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  {t('dashboard.todayConfirmed')}
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="text-3xl font-bold text-success">{stats?.todayConfirmed || 0}</div>
                )}
              </CardContent>
            </Card>
            <Card className={stats && stats.totalPending > 0 ? 'border-warning' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  {t('dashboard.totalPending')}
                  <AlertCircle className="h-4 w-4 text-warning" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className={`text-3xl font-bold ${stats && stats.totalPending > 0 ? 'text-warning' : ''}`}>
                    {stats?.totalPending || 0}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 月份汇总区域 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.monthSummary', { month: selectedMonth.replace('-', '年') })}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index}>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{t('dashboard.monthlyExpense')}</div>
                  <div className="text-2xl font-bold">¥{stats?.monthTotalExpense.toFixed(2) || '0.00'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{t('dashboard.monthlyCommission')}</div>
                  <div className="text-2xl font-bold">¥{stats?.monthTotalCommission.toFixed(2) || '0.00'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{t('dashboard.monthlyRecordCount')}</div>
                  <div className="text-2xl font-bold">{stats?.monthRecordCount || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{t('dashboard.monthlyOvertimeDays')}</div>
                  <div className="text-2xl font-bold">{stats?.monthOvertimeDays || 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 各司机月度概览表格 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.driverMonthOverview', { month: selectedMonth.replace('-', '年') })}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.driver')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.recordCount')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.totalExpense')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.totalCommission')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.pendingCount')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.confirmedCount')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.overtimeDays')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.advanceBalance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    driverStats.map((driver) => (
                      <TableRow key={driver.driver_id} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal"
                            onClick={() => handleDriverClick(driver.driver_id)}
                          >
                            {driver.driver_name}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">{driver.record_count}</TableCell>
                        <TableCell className="text-right">¥{driver.total_expense.toFixed(2)}</TableCell>
                        <TableCell className="text-right">¥{driver.total_commission.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{driver.pending_count}</TableCell>
                        <TableCell className="text-right">{driver.confirmed_count}</TableCell>
                        <TableCell className="text-right">{driver.overtime_days}</TableCell>
                        <TableCell className="text-right">¥{driver.advance_fund_balance.toFixed(2)}</TableCell>
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

export default DashboardPage;
