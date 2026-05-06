import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileImage, History, Link2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type {
  OperatingCompany,
  Vehicle,
  VehicleDataSource,
  VehicleDocumentType,
  VehicleKind,
  VehicleTrailer,
} from '@/types/database';
import {
  assignTrailerToTruck,
  getAvailableTrailers,
  getTruckTrailerAssignments,
  getVehicleDocuments,
  uploadVehicleDocument,
  type VehicleStats,
} from './api';
import {
  companyById,
  companyName,
  DATA_SOURCE_BADGE_CLASS,
  DATA_SOURCE_LABELS,
  getInspectionWarning,
  validateVehicleImage,
  VEHICLE_DOCUMENT_TYPES,
  VEHICLE_PAGE_SIZE,
} from './utils';

export function DataSourceBadge({ source }: { source?: VehicleDataSource | null }) {
  const value = source || 'legacy';
  return (
    <Badge variant="outline" className={DATA_SOURCE_BADGE_CLASS[value]}>
      {DATA_SOURCE_LABELS[value]}
    </Badge>
  );
}

export function StatCards({ stats, loading }: { stats?: VehicleStats; loading: boolean }) {
  const items = [
    { label: '车头总数', value: stats?.activeTrucks ?? 0 },
    { label: '已核对', value: stats?.verifiedTrucks ?? 0 },
    { label: '待核对', value: stats?.legacyTrucks ?? 0 },
    { label: '车挂数', value: stats?.activeTrailers ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="rounded-lg">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{item.label}</div>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-20" />
            ) : (
              <div className="mt-2 text-3xl font-semibold tabular-nums">{item.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListPagination({
  page,
  count,
  onPageChange,
}: {
  page: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / VEHICLE_PAGE_SIZE));

  return (
    <div className="flex items-center justify-between border-t pt-4 text-sm">
      <div className="text-muted-foreground">
        共 {count} 条，第 {page} / {totalPages} 页
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          上一页
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}

export function VehicleCardSkeleton() {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="hidden flex-1 space-y-2 md:block">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-20" />
      </CardContent>
    </Card>
  );
}

export function InspectionWarning({ value }: { value?: string | null }) {
  const warning = getInspectionWarning(value);
  if (!warning) return null;

  return (
    <div className="flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      {warning}
    </div>
  );
}

export function CompanySelect({
  value,
  companies,
  onChange,
  placeholder = '营运公司',
}: {
  value: string;
  companies: OperatingCompany[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全部营运公司</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id} value={String(company.id)}>
            {companyName(company)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function VehicleDocumentsPanel({
  vehicleKind,
  vehicleId,
  plateNumber,
}: {
  vehicleKind: VehicleKind;
  vehicleId: number;
  plateNumber: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['vehicle-documents', vehicleKind, vehicleId];
  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => getVehicleDocuments(vehicleKind, vehicleId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ documentType, file }: { documentType: VehicleDocumentType; file: File }) =>
      uploadVehicleDocument({ vehicleKind, vehicleId, plateNumber, documentType, file }),
    onSuccess: async () => {
      toast.success('证件已上传');
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '上传失败');
    },
  });

  const documents = documentsQuery.data ?? [];
  const byType = new Map(documents.map((document) => [document.document_type, document]));

  const handleFileChange = (documentType: VehicleDocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationMessage = validateVehicleImage(file);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    uploadMutation.mutate({ documentType, file });
  };

  if (documentsQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {VEHICLE_DOCUMENT_TYPES.map((item) => (
          <Skeleton key={item.type} className="h-44 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {VEHICLE_DOCUMENT_TYPES.map((item) => {
        const document = byType.get(item.type);
        const inputId = `${vehicleKind}-${vehicleId}-${item.type}`;
        const busy = uploadMutation.isPending && uploadMutation.variables?.documentType === item.type;

        return (
          <Card key={item.type} className="overflow-hidden rounded-lg">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm">{item.label}</CardTitle>
              <Badge variant="outline">{document ? '已上传' : '空位'}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <label
                htmlFor={inputId}
                className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted/30 text-muted-foreground transition hover:bg-muted"
              >
                {document?.signedUrl ? (
                  <img src={document.signedUrl} alt={item.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm">
                    <FileImage className="h-8 w-8" />
                    点击上传
                  </div>
                )}
              </label>
              <input
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleFileChange(item.type, event)}
              />
              <Button asChild variant="outline" size="sm" className="w-full" disabled={busy}>
                <label htmlFor={inputId} className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {busy ? '上传中...' : document ? '重新上传' : '上传图片'}
                </label>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AssignmentPanel({ truck }: { truck: Vehicle }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedTrailerId, setSelectedTrailerId] = React.useState('');
  const [note, setNote] = React.useState('');

  const assignmentsQuery = useQuery({
    queryKey: ['truck-assignments', truck.id],
    queryFn: () => getTruckTrailerAssignments(truck.id),
  });

  const availableTrailersQuery = useQuery({
    queryKey: ['available-trailers', truck.id],
    queryFn: () => getAvailableTrailers(truck.id),
    enabled: dialogOpen,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignTrailerToTruck({
        truckId: truck.id,
        trailerId: Number(selectedTrailerId),
        note: note.trim() || null,
      }),
    onSuccess: async () => {
      toast.success('车挂已分配');
      setDialogOpen(false);
      setSelectedTrailerId('');
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['truck-assignments', truck.id] }),
        queryClient.invalidateQueries({ queryKey: ['available-trailers', truck.id] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '分配失败');
    },
  });

  const assignments = assignmentsQuery.data ?? [];
  const current = assignments.find((assignment) => assignment.is_current);
  const history = assignments.filter((assignment) => !assignment.is_current);
  const availableTrailers = availableTrailersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <Card className="rounded-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">当前车挂</CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            分配新车挂
          </Button>
        </CardHeader>
        <CardContent>
          {assignmentsQuery.isLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : current?.trailer ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xl font-semibold">{current.trailer.plate_number}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {current.trailer.brand || '-'} {current.trailer.model || ''}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">分配时间：{current.assigned_from || '-'}</div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/vehicles/trailers/${current.trailer.id}`}>查看车挂</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">暂无当前车挂</div>
          )}
        </CardContent>
      </Card>

      <details className="rounded-lg border bg-card p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4" />
          历史分配记录（{history.length}）
        </summary>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无历史记录</div>
          ) : (
            history.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{assignment.trailer?.plate_number || `车挂 #${assignment.trailer_id}`}</div>
                <div className="mt-1 text-muted-foreground">
                  {assignment.assigned_from || '-'} 至 {assignment.assigned_until || '-'}
                </div>
                {assignment.note && <div className="mt-1 text-muted-foreground">备注：{assignment.note}</div>}
              </div>
            ))
          )}
        </div>
      </details>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配新车挂</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>车挂</Label>
              <Select value={selectedTrailerId} onValueChange={setSelectedTrailerId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择可用车挂" />
                </SelectTrigger>
                <SelectContent>
                  {availableTrailers.map((trailer) => (
                    <SelectItem key={trailer.id} value={String(trailer.id)}>
                      {trailer.plate_number} {trailer.brand ? `· ${trailer.brand}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!availableTrailersQuery.isLoading && availableTrailers.length === 0 && (
                <div className="text-xs text-muted-foreground">暂无可用车挂</div>
              )}
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" />
            </div>
            <Alert>
              <AlertTitle>分配规则</AlertTitle>
              <AlertDescription>提交后会结束该车头当前分配，并新增一条当前车挂记录。</AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!selectedTrailerId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? '提交中...' : '确认分配'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TruckMetaLine({
  vehicle,
  companies,
}: {
  vehicle: Vehicle;
  companies: OperatingCompany[];
}) {
  const company = companyById(companies, vehicle.operating_company_id);
  const viewCompanyShortName =
    'operating_company_short_name' in vehicle ? String(vehicle.operating_company_short_name || '') : '';
  return (
    <div className="text-sm text-muted-foreground">
      {vehicle.brand || '-'} {vehicle.model || ''} / {vehicle.asset_owner || '-'} / {viewCompanyShortName || companyName(company)}
    </div>
  );
}

export function TrailerMetaLine({
  trailer,
  companies,
}: {
  trailer: VehicleTrailer;
  companies: OperatingCompany[];
}) {
  const company = companyById(companies, trailer.operating_company_id);
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <div>
        {trailer.brand || '-'} {trailer.model || ''} / {trailer.asset_owner || '-'} /{' '}
        {trailer.operating_company_short_name || companyName(company)}
      </div>
      <div>当前车头：{trailer.current_truck_plate || '未分配'}</div>
    </div>
  );
}
