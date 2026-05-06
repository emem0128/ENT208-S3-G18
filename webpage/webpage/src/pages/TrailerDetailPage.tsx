import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VehicleTrailer } from '@/types/database';
import { getOperatingCompanies, getTrailer, updateTrailer } from '@/features/vehicles/api';
import { InspectionWarning, VehicleDocumentsPanel } from '@/features/vehicles/components';
import { emptyToNull, sanitizePlateNumber, toNullableNumber, trailerTitle } from '@/features/vehicles/utils';

type TrailerFormValues = {
  plate_number: string;
  asset_owner: string;
  vehicle_category: string;
  operating_company_id: string;
  brand: string;
  model: string;
  vin: string;
  registration_date: string;
  license_issue_date: string;
  archive_number: string;
  total_mass_kg: string;
  curb_mass_kg: string;
  load_mass_kg: string;
  dimensions: string;
  scrap_date: string;
  inspection_expiry: string;
  barcode: string;
  is_active: string;
};

const fieldGroups = {
  identity: [
    ['plate_number', '车牌号'],
    ['vin', '车架号'],
    ['archive_number', '档案编号'],
    ['barcode', '条形码'],
  ],
  model: [
    ['vehicle_category', '车辆类型'],
    ['brand', '品牌'],
    ['model', '型号'],
    ['asset_owner', '资产人'],
  ],
  specs: [
    ['total_mass_kg', '总质量 kg'],
    ['curb_mass_kg', '整备质量 kg'],
    ['load_mass_kg', '核定载质量 kg'],
    ['dimensions', '外观尺寸'],
  ],
  dates: [
    ['registration_date', '注册日期'],
    ['license_issue_date', '发证日期'],
    ['scrap_date', '强制报废日期'],
    ['inspection_expiry', '年审有效期'],
  ],
} as const;

function toFormValues(trailer: VehicleTrailer): TrailerFormValues {
  return {
    plate_number: trailer.plate_number || '',
    asset_owner: trailer.asset_owner || '',
    vehicle_category: trailer.vehicle_category || '',
    operating_company_id: trailer.operating_company_id ? String(trailer.operating_company_id) : 'none',
    brand: trailer.brand || '',
    model: trailer.model || '',
    vin: trailer.vin || '',
    registration_date: trailer.registration_date || '',
    license_issue_date: trailer.license_issue_date || '',
    archive_number: trailer.archive_number || '',
    total_mass_kg: trailer.total_mass_kg == null ? '' : String(trailer.total_mass_kg),
    curb_mass_kg: trailer.curb_mass_kg == null ? '' : String(trailer.curb_mass_kg),
    load_mass_kg: trailer.load_mass_kg == null ? '' : String(trailer.load_mass_kg),
    dimensions: trailer.dimensions || '',
    scrap_date: trailer.scrap_date || '',
    inspection_expiry: trailer.inspection_expiry || '',
    barcode: trailer.barcode || '',
    is_active: String(trailer.is_active),
  };
}

function toPayload(values: TrailerFormValues): Partial<VehicleTrailer> {
  return {
    plate_number: sanitizePlateNumber(values.plate_number),
    asset_owner: emptyToNull(values.asset_owner) as string | null,
    vehicle_category: emptyToNull(values.vehicle_category) as string | null,
    operating_company_id: values.operating_company_id === 'none' ? null : Number(values.operating_company_id),
    brand: emptyToNull(values.brand) as string | null,
    model: emptyToNull(values.model) as string | null,
    vin: emptyToNull(values.vin) as string | null,
    registration_date: emptyToNull(values.registration_date) as string | null,
    license_issue_date: emptyToNull(values.license_issue_date) as string | null,
    archive_number: emptyToNull(values.archive_number) as string | null,
    total_mass_kg: toNullableNumber(values.total_mass_kg),
    curb_mass_kg: toNullableNumber(values.curb_mass_kg),
    load_mass_kg: toNullableNumber(values.load_mass_kg),
    dimensions: emptyToNull(values.dimensions) as string | null,
    scrap_date: emptyToNull(values.scrap_date) as string | null,
    inspection_expiry: emptyToNull(values.inspection_expiry) as string | null,
    barcode: emptyToNull(values.barcode) as string | null,
    is_active: values.is_active === 'true',
  };
}

function FieldGrid({
  title,
  fields,
  register,
}: {
  title: string;
  fields: readonly (readonly [keyof TrailerFormValues, string])[];
  register: ReturnType<typeof useForm<TrailerFormValues>>['register'];
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fields.map(([name, label]) => {
          const isDate = String(name).includes('date') || String(name).includes('expiry');
          const isNumber = String(name).includes('_kg');
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

const TrailerDetailPage: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const trailerQuery = useQuery({
    queryKey: ['trailer', id],
    queryFn: () => getTrailer(id),
    enabled: Number.isFinite(id),
  });

  const companiesQuery = useQuery({
    queryKey: ['operating-companies'],
    queryFn: getOperatingCompanies,
  });

  const form = useForm<TrailerFormValues>();

  React.useEffect(() => {
    if (trailerQuery.data) {
      form.reset(toFormValues(trailerQuery.data));
    }
  }, [form, trailerQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (values: TrailerFormValues) => updateTrailer(id, toPayload(values)),
    onSuccess: async (trailer) => {
      toast.success('车挂信息已保存');
      form.reset(toFormValues(trailer));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trailer', id] }),
        queryClient.invalidateQueries({ queryKey: ['trailers'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '保存失败');
    },
  });

  const trailer = trailerQuery.data;
  const companies = companiesQuery.data ?? [];

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link to="/vehicles/trailers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回车挂列表
              </Link>
            </Button>
            {trailerQuery.isLoading ? (
              <Skeleton className="h-8 w-56" />
            ) : (
              <h1 className="text-2xl font-semibold">{trailerTitle(trailer)}</h1>
            )}
            {trailer && <InspectionWarning value={trailer.inspection_expiry} />}
          </div>
          <div className="text-sm text-muted-foreground">ID {trailer?.id ?? '-'} · 创建 {trailer?.created_at?.slice(0, 10) ?? '-'}</div>
        </div>

        {trailerQuery.isLoading ? (
          <Skeleton className="h-[520px] rounded-lg" />
        ) : !trailer ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">没有找到这个车挂</CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="documents">证件</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}>
                <Card className="rounded-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">状态</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                <FieldGrid title="标识" fields={fieldGroups.identity} register={form.register} />
                <FieldGrid title="车型" fields={fieldGroups.model} register={form.register} />
                <FieldGrid title="规格" fields={fieldGroups.specs} register={form.register} />
                <FieldGrid title="日期" fields={fieldGroups.dates} register={form.register} />

                <div className="sticky bottom-4 flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? '保存中...' : '保存基本信息'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="documents">
              <VehicleDocumentsPanel vehicleKind="trailer" vehicleId={trailer.id} plateNumber={trailer.plate_number} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default TrailerDetailPage;
