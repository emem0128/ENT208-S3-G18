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
import { format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const SummaryPage: React.FC = () => {
  const [records, setRecords] = useState<ExpenseRecordWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
      toast.error('加载司机列表失败');
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
      toast.error('加载总表数据失败');
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
      toast.info('正在生成Excel文件...');

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

        const wsData: any[][] = [];

        wsData.push([`${driver.name} ${startDate} 至 ${endDate} 短驳提成  备用金${totalRecharge}`]);

        wsData.push([
          '日期', '车牌', '司机', '路线', '过磅费', '提柜费', '过夜费', '越南超时费',
          '越南收钥匙', '停车费', '新岗', '打车', '淋水', '解篷布', '高速费', '盖章',
          '备注', '备注明细', '支出费用', '提成', '图片数量', '加班标记', '日期/客户'
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
            record.note_amount || '',
            record.note_detail || '',
            record.total_expense,
            record.commission || '',
            record.receipt_images?.length ? `${record.receipt_images.length}张` : '',
            record.is_overtime ? '加班' : '',
            ''
          ]);
        }

        wsData.push([]);
        wsData.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
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
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            `${format(new Date(fund.fund_date), 'M/d')}备用金`,
            fund.amount,
            '', '', '', '', '', ''
          ]);
        }

        wsData.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          '余',
          totalRecharge - totalExpense,
          '', '', ''
        ]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
          { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 15 },
          { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
        ];

        XLSX.utils.book_append_sheet(workbook, ws, driver.name);
      }

      XLSX.writeFile(workbook, `${startDate}_${endDate}_司机备用金.xlsx`);
      toast.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败，请重试');
    }
  };

  const handleExportImages = async () => {
    try {
      setExportingImages(true);
      toast.info('正在下载图片，请稍候...');

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
        toast.error('没有找到任何图片');
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
            if (!response.ok) throw new Error('下载失败');
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
        toast.error('所有图片下载失败，请检查网络');
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${startDate}_${endDate}_司机图片.zip`);

      if (failCount > 0) {
        toast.warning(`导出完成，${downloadCount}张成功，${failCount}张失败`);
      } else {
        toast.success(`导出成功，共${downloadCount}张图片`);
      }
    } catch (error) {
      console.error('导出图片失败:', error);
      toast.error('导出图片失败，请重试');
    } finally {
      setExportingImages(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">总表</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadRecords} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button onClick={handleExport} size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出Excel
            </Button>
            <Select value={imageGroupBy} onValueChange={(v) => setImageGroupBy(v as 'date' | 'driver')}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">按日期分组</SelectItem>
                <SelectItem value="driver">按司机分组</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExportImages} size="sm" loading={exportingImages} loadingText="导出中...">
              <Image className="h-4 w-4 mr-2" />
              导出图片
            </Button>
          </div>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>司机</Label>
                <Select value={driverId || 'all'} onValueChange={(value) => setDriverId(value === 'all' ? '' : value)}>
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
            </div>
          </CardContent>
        </Card>

        {/* 汇总信息 */}
        <Card>
          <CardHeader>
            <CardTitle>汇总信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">筛选范围内总支出</div>
                <div className="text-2xl font-bold">¥{getTotalExpense().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">筛选范围内总提成</div>
                <div className="text-2xl font-bold">¥{getTotalCommission().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">记录总条数</div>
                <div className="text-2xl font-bold">{records.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 总表展示 */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>加班</TableHead>
                      <TableHead>条数 / 合计</TableHead>
                      <TableHead className="text-right">提成合计</TableHead>
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
                                ? <span className="text-orange-600 font-medium">加班</span>
                                : <span className="text-muted-foreground">否</span>}
                            </TableCell>
                            <TableCell>{group.records.length} 条 · ¥{totalExpense.toFixed(2)}</TableCell>
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
                                  <span className="ml-2 text-muted-foreground">提成¥{Number(record.commission).toFixed(2)}</span>
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
