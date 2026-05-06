import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Vehicle, VehicleType } from '@/types/database';
import { getOperatingCompanies, getTruck, markTruckVerified, updateTruck } from '@/features/vehicles/api';
import {
  AssignmentPanel,
  DataSourceBadge,
  InspectionWarning,
  VehicleDocumentsPanel,
} from '@/features/vehicles/components';
import {
  emptyToNull,
  isTruckReadyToVerify,
  sanitizePlateNumber,
  toNullableNumber,
  truckTitle,
} from '@/features/vehicles/utils';

type TruckFormValues = {
  plate_number: string;
  vehicle_type: VehicleType;
  source: string;
  is_active: string;
  terminal_phone: string;
  fleet_name: string;
  group_number: string;
  group_leader: string;
  asset_owner: string;
  vehicle_model_short: string;
  vehicle_category: string;
  operating_company_id: string;
  brand: string;
  model: string;
  vin: string;
  engine_number: string;
  registration_date: string;
  license_issue_date: string;
  archive_number: string;
  approved_passengers: string;
  total_mass_kg: string;
  curb_mass_kg: string;
  load_mass_kg: string;
  traction_mass_kg: string;
  dimensions: string;
  scrap_date: string;
  inspection_expiry: string;
  barcode: string;
  insurance_expiry: string;
  filing_expiry: string;
};

const textFields = {
  identity: [
    ['plate_number', '车牌号'],
    ['vin', '车架号'],
    ['archive_number', '档案编号'],
    ['barcode', '条形码'],
  ],
  model: [
    ['vehicle_model_short', '车型简称'],
    ['vehicle_category', '车辆类型'],
    ['brand', '品牌'],
    ['model', '型号'],
    ['engine_number', '发动机号码'],
  ],
  ownership: [
    ['asset_owner', '资产人'],
    ['fleet_name', '车队名称'],
    ['source', '来源'],
  ],
  specs: [
    ['approved_passengers', '核定载人数'],
    ['total_mass_kg', '总质量 kg'],
    ['curb_mass_kg', '整备质量 kg'],
    ['load_mass_kg', '核定载质量 kg'],
    ['traction_mass_kg', '准牵引总质量 kg'],
    ['dimensions', '外观尺寸'],
  ],
  dates: [
    ['registration_date', '注册日期'],
    ['license_issue_date', '发证日期'],
    ['scrap_date', '强制报废日期'],
    ['inspection_expiry', '年审有效期'],
    ['insurance_expiry', '保险日期'],
    ['filing_expiry', '备案日期'],
  ],
  devices: [
    ['terminal_phone', '终端标识'],
    ['group_number', '分组编号'],
    ['group_leader', '组长'],
  ],
} as const;

function toFormValues(vehicle: Vehicle): TruckFormValues {
  return {
    plate_number: vehicle.plate_number || '',
    vehicle_type: vehicle.vehicle_type || 'own',
    source: vehicle.source || '',
    is_active: String(vehicle.is_active),
    terminal_phone: vehicle.terminal_phone || '',
    fleet_name: vehicle.fleet_name || '',
    group_number: vehicle.group_number || '',
    group_leader: vehicle.group_leader || '',
    asset_owner: vehicle.asset_owner || '',
    vehicle_model_short: vehicle.vehicle_model_short || '',
    vehicle_category: vehicle.vehicle_category || '',
    operating_company_id: vehicle.operating_company_id ? String(vehicle.operating_company_id) : 'none',
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    vin: vehicle.vin || '',
    engine_number: vehicle.engine_number || '',
    registration_date: vehicle.registration_date || '',
    license_issue_date: vehicle.license_issue_date || '',
    archive_number: vehicle.archive_number || '',
    approved_passengers: vehicle.approved_passengers == null ? '' : String(vehicle.approved_passengers),
    total_mass_kg: vehicle.total_mass_kg == null ? '' : String(vehicle.total_mass_kg),
    curb_mass_kg: vehicle.curb_mass_kg == null ? '' : String(vehicle.curb_mass_kg),
    load_mass_kg: vehicle.load_mass_kg == null ? '' : String(vehicle.load_mass_kg),
    traction_mass_kg: vehicle.traction_mass_kg == null ? '' : String(vehicle.traction_mass_kg),
    dimensions: vehicle.dimensions || '',
    scrap_date: vehicle.scrap_date || '',
    inspection_expiry: vehicle.inspection_expiry || '',
    barcode: vehicle.barcode || '',
    insurance_expiry: vehicle.insurance_expiry || '',
    filing_expiry: vehicle.filing_expiry || '',
  };
}

function toTruckPayload(values: TruckFormValues): Partial<Vehicle> {
  return {
    plate_number: sanitizePlateNumber(values.plate_number),
    vehicle_type: values.vehicle_type,
    source: emptyToNull(values.source) as string | null,
    is_active: values.is_active === 'true',
    terminal_phone: emptyToNull(values.terminal_phone) as string | null,
    fleet_name: emptyToNull(values.fleet_name) as string | null,
    group_number: emptyToNull(values.group_number) as string | null,
    group_leader: emptyToNull(values.group_leader) as string | null,
    asset_owner: emptyToNull(values.asset_owner) as string | null,
    vehicle_model_short: emptyToNull(values.vehicle_model_short) as string | null,
    vehicle_category: emptyToNull(values.vehicle_category) as string | null,
    operating_company_id: values.operating_company_id === 'none' ? null : Number(values.operating_company_id),
    brand: emptyToNull(values.brand) as string | null,
    model: emptyToNull(values.model) as string | null,
    vin: emptyToNull(values.vin) as string | null,
    engine_number: emptyToNull(values.engine_number) as string | null,
    registration_date: emptyToNull(values.registration_date) as string | null,
    license_issue_date: emptyToNull(values.license_issue_date) as string | null,
    archive_number: emptyToNull(values.archive_number) as string | null,
    approved_passengers: toNullableNumber(values.approved_passengers),
    total_mass_kg: toNullableNumber(values.total_mass_kg),
    curb_mass_kg: toNullableNumber(values.curb_mass_kg),
    load_mass_kg: toNullableNumber(values.load_mass_kg),
    traction_mass_kg: toNullableNumber(values.traction_mass_kg),
    dimensions: emptyToNull(values.dimensions) as string | null,
    scrap_date: emptyToNull(values.scrap_date) as string | null,
    inspection_expiry: emptyToNull(values.inspection_expiry) as string | null,
    barcode: emptyToNull(values.barcode) as string | null,
    insurance_expiry: emptyToNull(values.insurance_expiry) as string | null,
    filing_expiry: emptyToNull(values.filing_expiry) as string | null,
  };
}

function FieldGrid({
  title,
  fields,
  register,
}: {
  title: string;
  fields: readonly (readonly [keyof TruckFormValues, string])[];
  register: ReturnType<typeof useForm<TruckFormValues>>['register'];
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fields.map(([name, label]) => {
          const isDate = String(name).includes('date') || String(name).includes('expiry');
          const isNumber = String(name).includes('_kg') || name === 'approved_passengers';
          return (
            <div key={name} className="space-y-2">
              <Label>{label}</Label>
              <Input type={isDate ? 'date' : isNumber ? 'number' : 'text'} {...register(name)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const VehicleDetailPage: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const truckQuery = useQuery({
    queryKey: ['truck', id],
    queryFn: () => getTruck(id),
    enabled: Number.isFinite(id),
  });

  const companiesQuery = useQuery({
    queryKey: ['operating-companies'],
    queryFn: getOperatingCompanies,
  });

  const form = useForm<TruckFormValues>();

  React.useEffect(() => {
    if (truckQuery.data) {
      form.reset(toFormValues(truckQuery.data));
    }
  }, [form, truckQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (values: TruckFormValues) => updateTruck(id, toTruckPayload(values)),
    onSuccess: async (vehicle) => {
      toast.success('车辆信息已保存');
      form.reset(toFormValues(vehicle));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['truck', id] }),
        queryClient.invalidateQueries({ queryKey: ['trucks'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '保存失败');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => markTruckVerified(id),
    onSuccess: async (vehicle) => {
      toast.success('已标记为已核对');
      form.reset(toFormValues(vehicle));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['truck', id] }),
        queryClient.invalidateQueries({ queryKey: ['trucks'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '标记失败');
    },
  });

  const truck = truckQuery.data;
  const companies = companiesQuery.data ?? [];
  const canVerify = truck && (truck.data_source === 'legacy' || truck.data_source === 'manual') && isTruckReadyToVerify(truck);

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link to="/vehicles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回车辆列表
              </Link>
            </Button>
            {truckQuery.isLoading ? (
              <Skeleton className="h-8 w-56" />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{truckTitle(truck)}</h1>
                {truck && <DataSourceBadge source={truck.data_source} />}
              </div>
            )}
            {truck && <InspectionWarning value={truck.inspection_expiry} />}
          </div>
          <div className="text-sm text-muted-foreground">
            ID {truck?.id ?? '-'} · 创建 {truck?.created_at?.slice(0, 10) ?? '-'} · 更新 {truck?.updated_at?.slice(0, 10) ?? '-'}
          </div>
        </div>

        {truckQuery.isLoading ? (
          <Skeleton className="h-[520px] rounded-lg" />
        ) : !truck ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">没有找到这辆车</CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="documents">证件</TabsTrigger>
              <TabsTrigger value="trailers">关联车挂</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {canVerify && (
                <Alert className="border-green-200 bg-green-50 text-green-900">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>信息已完整，是否标记为已核对？</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <span>车架号、品牌、型号、营运公司、注册日期、年审有效期均已填写。</span>
                    <Button size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                      {verifyMutation.isPending ? '标记中...' : '标记为已核对'}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <form className="space-y-4" onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}>
                <Card className="rounded-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">状态</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>车辆归属类型</Label>
                      <Select
                        value={form.watch('vehicle_type') || 'own'}
                        onValueChange={(value: VehicleType) => form.setValue('vehicle_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">自有车</SelectItem>
                          <SelectItem value="affiliated">挂靠车</SelectItem>
                          <SelectItem value="rented">租用车</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>是否启用</Label>
                      <Select
                        value={form.watch('is_active') || 'true'}
                        onValueChange={(value) => form.setValue('is_active', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">启用</SelectItem>
                          <SelectItem value="false">停用</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>营运公司</Label>
                      <Select
                        value={form.watch('operating_company_id') || 'none'}
                        onValueChange={(value) => form.setValue('operating_company_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="暂无" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">暂无</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={String(company.id)}>
                              {company.short_name || company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <FieldGrid title="标识" fields={textFields.identity} register={form.register} />
                <FieldGrid title="车型" fields={textFields.model} register={form.register} />
                <FieldGrid title="归属" fields={textFields.ownership} register={form.register} />
                <FieldGrid title="规格" fields={textFields.specs} register={form.register} />
                <FieldGrid title="日期" fields={textFields.dates} register={form.register} />
                <FieldGrid title="设备" fields={textFields.devices} register={form.register} />

                <div className="sticky bottom-4 flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? '保存中...' : '保存基本信息'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="documents">
              <VehicleDocumentsPanel vehicleKind="truck" vehicleId={truck.id} plateNumber={truck.plate_number} />
            </TabsContent>

            <TabsContent value="trailers">
              <AssignmentPanel truck={truck} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default VehicleDetailPage;
