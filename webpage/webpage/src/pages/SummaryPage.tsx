import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Download, RefreshCw, Image, ChevronDown, ChevronRight } from 'lucide-react';
import { getExpenseRecords, getAllDrivers, getAdvanceFundRecords } from '@/db/api';
import type { ExpenseRecordWithDriver, Driver, AdvanceFundRecordWithDriver } from '@/types/database';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';

const SummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<ExpenseRecordWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const groupedRecords = records.reduce((groups, record) => {
    const key = `${record.record_date}_${record.driver_id}`;
    if (!groups[key]) {
      groups[key] = {
        date: record.record_date,
        driverName: record.driver?.name || '-',
        isOvertime: false,
        records: [],
      };
    }
    if (record.is_overtime) groups[key].isOvertime = true;
    groups[key].records.push(record);
    return groups;
  }, {} as Record<string, { date: string; driverName: string; isOvertime: boolean; records: ExpenseRecordWithDriver[] }>);

  const sortedGroupKeys = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));
  const [driverId, setDriverId] = useState('');
  const [imageGroupBy, setImageGroupBy] = useState<'date' | 'driver'>('date');
  const [exportingImages, setExportingImages] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [startDate, endDate, driverId]);

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
        driverId: driverId ? Number(driverId) : undefined,
        startDate,
        endDate,
        status: 'confirmed',
      });
      setRecords(data);
    } catch (error) {
      console.error('加载总表数据失败:', error);
      toast.error(t('toast.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getTotalExpense = () => {
    return records.reduce((sum, r) => sum + Number(r.total_expense), 0);
  };

  const getTotalCommission = () => {
    return records.reduce((sum, r) => sum + Number(r.commission), 0);
  };

  const handleExport = async () => {
    try {
      toast.info(t('toast.exportingExcel'));

      const workbook = XLSX.utils.book_new();

      const exportDrivers = driverId
        ? drivers.filter(d => d.id === Number(driverId))
        : drivers;

      for (const driver of exportDrivers) {
        const driverRecords = await getExpenseRecords({
          driverId: driver.id,
          startDate,
          endDate,
          status: 'confirmed',
        });

        // 备用金仍按月查，取开始日期所在月
        const fundMonth = startDate.substring(0, 7);
        const fundRecords = await getAdvanceFundRecords({
          driverId: driver.id,
          month: fundMonth,
        });

        const totalRecharge = fundRecords.reduce((sum, r) => sum + Number(r.amount), 0);
        const totalExpense = driverRecords.reduce((sum, r) => sum + Number(r.total_expense), 0);
        const totalCommission = driverRecords.reduce((sum, r) => sum + Number(r.commission), 0);

        const overtimeDates = new Set(
          driverRecords.filter(r => r.is_overtime).map(r => r.record_date)
        );

        const buildOtherFeeNames = (record: ExpenseRecordWithDriver) => {
          if (record.other_fees && record.other_fees.length > 0) {
            return record.other_fees.map((item) => item.name).join('/');
          }

          const legacyNames = (record.note_detail || '')
            .split(/[;；]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => item.replace('：', ':').split(':')[0]?.trim())
            .filter(Boolean);

          return legacyNames.join('/');
        };

        const buildRemarkText = (record: ExpenseRecordWithDriver) => {
          const remarkParts: string[] = [];

          const locationDetail = (record.fee_location_detail || '')
            .split(/[;；]/)
            .map((item) => item.trim())
            .filter(Boolean);

          if (locationDetail.length > 0) {
            const groupedLocationDetails = locationDetail.reduce((groups, item) => {
              const match = item.match(/^(.+?)\((.+?)\):\s*(-?\d+(\.\d+)?)$/);
              if (!match) return groups;
              const displayName = match[1].trim();
              const location = match[2].trim();
              const amount = match[3].trim();
              if (!location) return groups;
              if (!groups[displayName]) groups[displayName] = [];
              groups[displayName].push(`${location}${amount}`);
              return groups;
            }, {} as Record<string, string[]>);

            Object.entries(groupedLocationDetails).forEach(([displayName, entries]) => {
              if (entries.length > 0) {
                remarkParts.push(`${displayName}：${entries.join('；')}`);
              }
            });
          }

          if (record.other_fees && record.other_fees.length > 0) {
            remarkParts.push(`其他费用：${record.other_fees.map((item) => `${item.name}${item.amount}`).join('；')}`);
          } else {
            const legacyOther = (record.note_detail || '').trim();
            if (legacyOther) {
              remarkParts.push(`其他费用：${legacyOther.replace(/[;；]\s*/g, '；')}`);
            }
          }

          return remarkParts.join('；');
        };

        const wsData: any[][] = [];

        wsData.push([`${driver.name} | 导出范围：${startDate} 至 ${endDate} | 该范围内备用金充值：¥${totalRecharge.toFixed(2)}`]);

        wsData.push([
          '日期', '车牌', '司机', '路线', '过磅费', '提柜费', '过夜费', '越南超时费',
          '越南收钥匙', '停车费', '新岗', '打车', '淋水', '解篷布', '高速费', '盖章',
          '其他费用', '其他费用金额', '备注', '支出费用', '提成', '图片数量', '加班标记', '日期/客户'
        ]);

        driverRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));
        for (const record of driverRecords) {
          wsData.push([
            format(new Date(record.record_date), 'MM/dd'),
            record.plate_number,
            driver.name,
            record.route || '',
            record.fee_weighing || '',
            record.fee_container || '',
            record.fee_overnight || '',
            record.fee_vn_overtime || '',
            record.fee_vn_key || '',
            record.fee_parking || '',
            record.fee_newpost || '',
            record.fee_taxi || '',
            record.fee_water || '',
            record.fee_tarpaulin || '',
            record.fee_highway || '',
            record.fee_stamp || '',
            buildOtherFeeNames(record),
            record.note_amount || '',
            buildRemarkText(record),
            record.total_expense,
            record.commission || '',
            record.receipt_images?.length ? `${record.receipt_images.length}张` : '',
            record.is_overtime ? '加班' : '',
            ''
          ]);
        }

        wsData.push([]);
        wsData.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          totalExpense,
          totalCommission,
          '',
          `${overtimeDates.size}个加班`,
          ''
        ]);

        wsData.push([]);
        wsData.push([]);
        for (const fund of fundRecords) {
          wsData.push([
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            `${format(new Date(fund.fund_date), 'M/d')}备用金`,
            fund.amount,
            '', '', '', '', '', ''
          ]);
        }

        wsData.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          '余',
          totalRecharge - totalExpense,
          '', '', ''
        ]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
          { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
          { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }
        ];

        XLSX.utils.book_append_sheet(workbook, ws, driver.name);
      }

      XLSX.writeFile(workbook, `${startDate}_${endDate}_司机备用金.xlsx`);
      toast.success(t('toast.exportSuccess'));
    } catch (error) {
      console.error('导出失败:', error);
      toast.error(t('toast.exportFailed'));
    }
  };

  const handleExportImages = async () => {
    try {
      setExportingImages(true);
      toast.info(t('toast.downloadingImages'));

      const exportDrivers = driverId
        ? drivers.filter(d => d.id === Number(driverId))
        : drivers;

      // 收集所有有图片的记录
      const allRecordsWithImages: { record: ExpenseRecordWithDriver; driverName: string }[] = [];
      for (const driver of exportDrivers) {
        const driverRecords = await getExpenseRecords({
          driverId: driver.id,
          startDate,
          endDate,
          status: 'confirmed',
        });
        for (const record of driverRecords) {
          if (record.receipt_images && record.receipt_images.length > 0) {
            allRecordsWithImages.push({ record, driverName: driver.name });
          }
        }
      }

      if (allRecordsWithImages.length === 0) {
        toast.error(t('toast.noImages'));
        return;
      }

      const zip = new JSZip();
      let downloadCount = 0;
      let failCount = 0;

      for (const { record, driverName } of allRecordsWithImages) {
        const dateStr = format(new Date(record.record_date), 'MM-dd');
        const plate = record.plate_number;

        for (let i = 0; i < record.receipt_images!.length; i++) {
          const url = record.receipt_images![i];
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('download failed');
            const blob = await response.blob();
            const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `${plate}_${i + 1}.${ext}`;

            let folder: JSZip;
            if (imageGroupBy === 'date') {
              folder = zip.folder(dateStr)!.folder(driverName)!;
            } else {
              folder = zip.folder(driverName)!.folder(dateStr)!;
            }
            folder.file(fileName, blob);
            downloadCount++;
          } catch {
            failCount++;
          }
        }
      }

      if (downloadCount === 0) {
        toast.error(t('toast.allImagesFailed'));
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${startDate}_${endDate}_司机图片.zip`);

      if (failCount > 0) {
        toast.warning(t('toast.imageExportPartial', { success: downloadCount, failed: failCount }));
      } else {
        toast.success(t('toast.imageExportSuccess', { count: downloadCount }));
      }
    } catch (error) {
      console.error('导出图片失败:', error);
      toast.error(t('toast.exportFailed'));
    } finally {
      setExportingImages(false);
    }
  };

  const applyDateRange = (range: 'thisMonth' | 'lastMonth' | 'last7Days' | 'thisYear') => {
    const now = new Date();

    if (range === 'thisMonth') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
      return;
    }

    if (range === 'lastMonth') {
      const lastMonth = subMonths(now, 1);
      setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
      return;
    }

    if (range === 'last7Days') {
      setStartDate(format(subDays(now, 6), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      return;
    }

    setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
    setEndDate(format(now, 'yyyy-MM-dd'));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('summary.title')}</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadRecords} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh')}
            </Button>
            <Button onClick={handleExport} size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t('common.exportExcel')}
            </Button>
            <Select value={imageGroupBy} onValueChange={(v) => setImageGroupBy(v as 'date' | 'driver')}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t('summary.groupByDate')}</SelectItem>
                <SelectItem value="driver">{t('summary.groupByDriver')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExportImages} size="sm" loading={exportingImages} loadingText={t('common.exporting')}>
              <Image className="h-4 w-4 mr-2" />
              {t('common.exportImages')}
            </Button>
          </div>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex flex-col gap-2">
                <Label>{t('common.startDate')}</Label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('common.endDate')}</Label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => applyDateRange('thisMonth')}>
                  {t('summary.thisMonth')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyDateRange('lastMonth')}>
                  {t('summary.lastMonth')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyDateRange('last7Days')}>
                  {t('summary.last7Days')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyDateRange('thisYear')}>
                  {t('summary.thisYear')}
                </Button>
              </div>
              <div className="flex min-w-48 flex-1 flex-col gap-2">
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

        {/* 汇总信息 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('summary.summaryInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">{t('summary.filteredExpense')}</div>
                <div className="text-2xl font-bold">¥{getTotalExpense().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">{t('summary.filteredCommission')}</div>
                <div className="text-2xl font-bold">¥{getTotalCommission().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">{t('summary.totalRecords')}</div>
                <div className="text-2xl font-bold">{records.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 总表展示 */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.noData')}</div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('common.driver')}</TableHead>
                      <TableHead>{t('common.overtime')}</TableHead>
                      <TableHead>{t('summary.countAndTotal')}</TableHead>
                      <TableHead className="text-right">{t('summary.commissionTotal')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedGroupKeys.map((groupKey) => {
                      const group = groupedRecords[groupKey];
                      const isExpanded = expandedGroups.has(groupKey);
                      const totalExpense = group.records.reduce((sum, r) => sum + Number(r.total_expense), 0);
                      const totalCommission = group.records.reduce((sum, r) => sum + Number(r.commission), 0);

                      return (
                        <React.Fragment key={groupKey}>
                          {/* 分组行 */}
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50 bg-muted/20 font-medium"
                            onClick={() => toggleGroup(groupKey)}
                          >
                            <TableCell>
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell>{group.date}</TableCell>
                            <TableCell>{group.driverName}</TableCell>
                            <TableCell>
                              {group.isOvertime
                                ? <span className="text-orange-600 font-medium">{t('common.overtime')}</span>
                                : <span className="text-muted-foreground">{t('common.no')}</span>}
                            </TableCell>
                            <TableCell>{t('summary.rowsWithAmount', { count: group.records.length, amount: totalExpense.toFixed(2) })}</TableCell>
                            <TableCell className="text-right">¥{totalCommission.toFixed(2)}</TableCell>
                          </TableRow>

                          {/* 展开明细 */}
                          {isExpanded && group.records.map((record) => (
                            <TableRow key={record.id} className="bg-background text-sm">
                              <TableCell></TableCell>
                              <TableCell className="text-muted-foreground pl-6">{record.plate_number}</TableCell>
                              <TableCell className="text-muted-foreground">{record.route || '-'}</TableCell>
                              <TableCell className="text-muted-foreground" colSpan={2}>
                                ¥{Number(record.total_expense).toFixed(2)}
                                {Number(record.commission) > 0 && (
                                  <span className="ml-2 text-muted-foreground">{t('summary.commissionPrefix', { amount: Number(record.commission).toFixed(2) })}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground text-xs">
                                {record.confirmed_by} {record.confirmed_at ? format(new Date(record.confirmed_at), 'MM-dd HH:mm') : ''}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SummaryPage;
