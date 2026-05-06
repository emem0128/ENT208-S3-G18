import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VehicleType } from '@/types/database';
import {
  createManualTruck,
  getOperatingCompanies,
  getTrailers,
  getTrucks,
  getVehicleModelOptions,
  getVehicleStats,
  type ManualTruckInput,
  type TrailerListFilters,
  type TruckListFilters,
} from '@/features/vehicles/api';
import {
  CompanySelect,
  DataSourceBadge,
  InspectionWarning,
  ListPagination,
  StatCards,
  TrailerMetaLine,
  TruckMetaLine,
  VehicleCardSkeleton,
} from '@/features/vehicles/components';
import { sanitizePlateNumber } from '@/features/vehicles/utils';

type ManualTruckForm = {
  plate_number: string;
  vehicle_type: VehicleType;
  vehicle_model_short: string;
  vehicle_category: string;
  asset_owner: string;
  operating_company_id: string;
  brand: string;
  model: string;
  terminal_phone: string;
};

const defaultTruckFilters: TruckListFilters = {
  search: '',
  vehicleModelShort: 'all',
  dataSource: 'all',
  operatingCompanyId: 'all',
  page: 1,
};

const defaultTrailerFilters: TrailerListFilters = {
  search: '',
  operatingCompanyId: 'all',
  page: 1,
};

function normalizeOptional(value: string) {
  return value.trim() || null;
}

const VehiclesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isTrailerTab = location.pathname === '/vehicles/trailers';

  const [truckFilters, setTruckFilters] = React.useState<TruckListFilters>(defaultTruckFilters);
  const [trailerFilters, setTrailerFilters] = React.useState<TrailerListFilters>(defaultTrailerFilters);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const statsQuery = useQuery({
    queryKey: ['vehicle-stats'],
    queryFn: getVehicleStats,
  });

  const companiesQuery = useQuery({
    queryKey: ['operating-companies'],
    queryFn: getOperatingCompanies,
  });

  const modelsQuery = useQuery({
    queryKey: ['vehicle-model-options'],
    queryFn: getVehicleModelOptions,
  });

  const trucksQuery = useQuery({
    queryKey: ['trucks', truckFilters],
    queryFn: () => getTrucks(truckFilters),
    enabled: !isTrailerTab,
  });

  const trailersQuery = useQuery({
    queryKey: ['trailers', trailerFilters],
    queryFn: () => getTrailers(trailerFilters),
    enabled: isTrailerTab,
  });

  const form = useForm<ManualTruckForm>({
    defaultValues: {
      plate_number: '',
      vehicle_type: 'own',
      vehicle_model_short: '',
      vehicle_category: '',
      asset_owner: '',
      operating_company_id: 'none',
      brand: '',
      model: '',
      terminal_phone: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ManualTruckInput) => createManualTruck(values),
    onSuccess: async (vehicle) => {
      toast.success('车辆已新增');
      setDialogOpen(false);
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trucks'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-model-options'] }),
      ]);
      navigate(`/vehicles/${vehicle.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '新增失败');
    },
  });

  const companies = companiesQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const truckResult = trucksQuery.data;
  const trailerResult = trailersQuery.data;

  const setTruckFilter = <K extends keyof TruckListFilters>(key: K, value: TruckListFilters[K]) => {
    setTruckFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? Number(value) : 1,
    }));
  };

  const setTrailerFilter = <K extends keyof TrailerListFilters>(key: K, value: TrailerListFilters[K]) => {
    setTrailerFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? Number(value) : 1,
    }));
  };

  const refreshActiveTab = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] }),
      queryClient.invalidateQueries({ queryKey: isTrailerTab ? ['trailers'] : ['trucks'] }),
    ]);
    toast.success('已刷新');
  };

  const submitManualTruck = (values: ManualTruckForm) => {
    const plateNumber = sanitizePlateNumber(values.plate_number);
    if (!plateNumber || !values.vehicle_model_short.trim()) {
      toast.error('请填写车牌号和车型简称');
      return;
    }

    createMutation.mutate({
      plate_number: plateNumber,
      vehicle_type: values.vehicle_type,
      vehicle_model_short: values.vehicle_model_short.trim(),
      vehicle_category: normalizeOptional(values.vehicle_category),
      asset_owner: normalizeOptional(values.asset_owner),
      operating_company_id:
        values.operating_company_id && values.operating_company_id !== 'none'
          ? Number(values.operating_company_id)
          : null,
      brand: normalizeOptional(values.brand),
      model: normalizeOptional(values.model),
      terminal_phone: normalizeOptional(values.terminal_phone),
    });
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">车辆管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理车头、车挂、证件和车挂分配关系</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={refreshActiveTab} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新增车辆
            </Button>
          </div>
        </div>

        <StatCards stats={statsQuery.data} loading={statsQuery.isLoading} />

        <Tabs value={isTrailerTab ? 'trailers' : 'trucks'} className="space-y-4">
          <TabsList>
            <TabsTrigger value="trucks" asChild>
              <Link to="/vehicles">车头列表</Link>
            </TabsTrigger>
            <TabsTrigger value="trailers" asChild>
              <Link to="/vehicles/trailers">车挂列表</Link>
            </TabsTrigger>
          </TabsList>

          {!isTrailerTab ? (
            <Card className="rounded-lg">
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="搜索车牌号 / VIN / 品牌"
                      value={truckFilters.search}
                      onChange={(event) => setTruckFilter('search', event.target.value)}
                    />
                  </div>
                  <Select value={truckFilters.vehicleModelShort} onValueChange={(value) => setTruckFilter('vehicleModelShort', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="车型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部车型</SelectItem>
                      {models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={truckFilters.dataSource}
                    onValueChange={(value) => setTruckFilter('dataSource', value as TruckListFilters['dataSource'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="数据来源" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部来源</SelectItem>
                      <SelectItem value="verified">已核对</SelectItem>
                      <SelectItem value="manual">手动添加</SelectItem>
                      <SelectItem value="legacy">待核对</SelectItem>
                    </SelectContent>
                  </Select>
                  <CompanySelect
                    value={truckFilters.operatingCompanyId}
                    companies={companies}
                    onChange={(value) => setTruckFilter('operatingCompanyId', value)}
                  />
                </div>

                <div className="space-y-3">
                  {trucksQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => <VehicleCardSkeleton key={index} />)
                  ) : truckResult?.rows.length ? (
                    truckResult.rows.map((vehicle) => (
                      <Card key={vehicle.id} className="rounded-lg">
                        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_2fr_auto] md:items-center">
                          <div>
                            <div className="text-2xl font-semibold tracking-wide">{vehicle.plate_number}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{vehicle.vehicle_model_short || '-'}</div>
                          </div>
                          <div className="space-y-2">
                            <TruckMetaLine vehicle={vehicle} companies={companies} />
                            <InspectionWarning value={vehicle.inspection_expiry} />
                          </div>
                          <div className="flex items-center gap-2 md:flex-col md:items-end">
                            <DataSourceBadge source={vehicle.data_source} />
                            <Button asChild size="sm" variant={vehicle.data_source === 'legacy' ? 'default' : 'outline'}>
                              <Link to={`/vehicles/${vehicle.id}`}>{vehicle.data_source === 'legacy' ? '补全' : '查看'}</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">暂无车辆</div>
                  )}
                </div>

                <ListPagination
                  page={truckFilters.page}
                  count={truckResult?.count ?? 0}
                  onPageChange={(page) => setTruckFilter('page', page)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg">
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="搜索车牌号 / VIN / 品牌"
                      value={trailerFilters.search}
                      onChange={(event) => setTrailerFilter('search', event.target.value)}
                    />
                  </div>
                  <CompanySelect
                    value={trailerFilters.operatingCompanyId}
                    companies={companies}
                    onChange={(value) => setTrailerFilter('operatingCompanyId', value)}
                  />
                </div>

                <div className="space-y-3">
                  {trailersQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => <VehicleCardSkeleton key={index} />)
                  ) : trailerResult?.rows.length ? (
                    trailerResult.rows.map((trailer) => (
                      <Card key={trailer.id} className="rounded-lg">
                        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_2fr_auto] md:items-center">
                          <div>
                            <div className="text-2xl font-semibold tracking-wide">{trailer.plate_number}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{trailer.vehicle_category || '-'}</div>
                          </div>
                          <div className="space-y-2">
                            <TrailerMetaLine trailer={trailer} companies={companies} />
                            <InspectionWarning value={trailer.inspection_expiry} />
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/vehicles/trailers/${trailer.id}`}>查看</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">暂无车挂</div>
                  )}
                </div>

                <ListPagination
                  page={trailerFilters.page}
                  count={trailerResult?.count ?? 0}
                  onPageChange={(page) => setTrailerFilter('page', page)}
                />
              </CardContent>
            </Card>
          )}
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增车辆</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(submitManualTruck)}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="plate_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>车牌号</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="例如 桂FB0797" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>车辆归属类型</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="own">自有车</SelectItem>
                          <SelectItem value="affiliated">挂靠车</SelectItem>
                          <SelectItem value="rented">租用车</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_model_short"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>车型简称</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="例如 45HQ-1" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>车辆类型</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="例如 重型半挂牵引车" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="asset_owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资产人</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="operating_company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>营运公司</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="暂无" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">暂无</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={String(company.id)}>
                              {company.short_name || company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>品牌</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>型号</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2">
                  <Label>终端标识</Label>
                  <Input className="mt-2" {...form.register('terminal_phone')} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? '保存中...' : '保存并查看'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default VehiclesPage;
