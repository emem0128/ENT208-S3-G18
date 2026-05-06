import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Map as MapIcon, RefreshCw, Search, Truck } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    TMap?: any;
  }
}

type ActiveVehicle = {
  id: number;
  plate_number: string;
  terminal_phone: string | null;
};

type LocationRow = {
  vehicle_id: number;
  terminal_phone: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  speed: number | string | null;
  direction: number | string | null;
  gps_time: string | null;
  created_at: string | null;
  vehicles?: Array<{
    id: number;
    plate_number: string;
    terminal_phone: string | null;
    is_active: boolean;
  }>;
};

type VehicleTrackingItem = {
  id: number;
  plateNumber: string;
  terminalPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  direction: number | null;
  gpsTime: string | null;
  createdAt: string | null;
  isOnline: boolean;
  hasLocation: boolean;
};

const NANNING_CENTER = { lng: 108.366, lat: 22.817 };
const REFRESH_INTERVAL = 30_000;
const ONLINE_WINDOW_MS = 30 * 60 * 1000;

const createTruckIcon = (color: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2C10.82 2 5 7.82 5 15C5 25.15 18 42 18 42C18 42 31 25.15 31 15C31 7.82 25.18 2 18 2Z" fill="${color}"/>
      <path d="M11 13.5H20V20H11V13.5Z" fill="white"/>
      <path d="M20 15H25L27 17.3V20H20V15Z" fill="white"/>
      <circle cx="14" cy="21.5" r="2" fill="${color}"/>
      <circle cx="24" cy="21.5" r="2" fill="${color}"/>
    </svg>
  `)}`;

const ONLINE_MARKER = createTruckIcon('#16a34a');
const OFFLINE_MARKER = createTruckIcon('#6b7280');

const parseNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const formatRelativeTime = (value: string | null, t: (key: string) => string) => {
  if (!value) {
    return t('tracking.noReport');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('tracking.invalidTime');
  }

  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: zhCN,
  });
};

const formatGpsTime = (value: string | null, t: (key: string) => string) => {
  if (!value) {
    return t('tracking.none');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, 'yyyy-MM-dd HH:mm:ss');
};

const buildInfoContent = (vehicle: VehicleTrackingItem, t: (key: string, options?: Record<string, unknown>) => string) => {
  const speed = vehicle.speed ?? 0;
  const longitude = vehicle.longitude?.toFixed(6) ?? '-';
  const latitude = vehicle.latitude?.toFixed(6) ?? '-';

  return `
    <div style="min-width:220px;padding:4px 2px;color:#0f172a;">
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">${vehicle.plateNumber}</div>
      <div style="font-size:13px;line-height:1.8;">${t('tracking.speed', { speed })}</div>
      <div style="font-size:13px;line-height:1.8;">${t('tracking.gpsTime', { time: formatGpsTime(vehicle.gpsTime, t) })}</div>
      <div style="font-size:13px;line-height:1.8;">${t('tracking.lngLat', { lng: longitude, lat: latitude })}</div>
    </div>
  `;
};

const VehicleTracking: React.FC = () => {
  const { t } = useTranslation();
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const infoWindowRef = React.useRef<any>(null);
  const vehicleMapRef = React.useRef<globalThis.Map<number, VehicleTrackingItem>>(new globalThis.Map());
  const [vehicles, setVehicles] = React.useState<VehicleTrackingItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const filteredVehicles = React.useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return vehicles;
    }

    return vehicles.filter((vehicle) => vehicle.plateNumber.toLowerCase().includes(keyword));
  }, [searchTerm, vehicles]);

  const updateMarkerLayer = React.useCallback((items: VehicleTrackingItem[]) => {
    const TMap = window.TMap;
    if (!TMap || !mapRef.current || !markerRef.current) {
      return;
    }

    const geometries = items
      .filter((item) => item.hasLocation && item.longitude !== null && item.latitude !== null)
      .map((item) => ({
        id: String(item.id),
        styleId: item.isOnline ? 'online' : 'offline',
        position: new TMap.LatLng(item.latitude, item.longitude),
      }));

    markerRef.current.setGeometries(geometries);
  }, []);

  const openVehicleInfo = React.useCallback((vehicle: VehicleTrackingItem, flyTo = false) => {
    const TMap = window.TMap;
    if (!TMap || !mapRef.current || !infoWindowRef.current || vehicle.latitude === null || vehicle.longitude === null) {
      return;
    }

    const position = new TMap.LatLng(vehicle.latitude, vehicle.longitude);

    if (flyTo) {
      mapRef.current.easeTo({
        center: position,
        zoom: Math.max(mapRef.current.getZoom?.() ?? 12, 12),
      });
    }

    infoWindowRef.current.setPosition(position);
    infoWindowRef.current.setContent(buildInfoContent(vehicle, t));
    infoWindowRef.current.open();
  }, [t]);

  const initializeMap = React.useCallback(() => {
    const TMap = window.TMap;
    if (!TMap || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = new TMap.Map(mapContainerRef.current, {
      center: new TMap.LatLng(NANNING_CENTER.lat, NANNING_CENTER.lng),
      zoom: 8,
      pitch: 0,
      rotation: 0,
    });

    markerRef.current = new TMap.MultiMarker({
      map: mapRef.current,
      styles: {
        online: new TMap.MarkerStyle({
          width: 36,
          height: 44,
          anchor: { x: 18, y: 40 },
          src: ONLINE_MARKER,
        }),
        offline: new TMap.MarkerStyle({
          width: 36,
          height: 44,
          anchor: { x: 18, y: 40 },
          src: OFFLINE_MARKER,
        }),
      },
      geometries: [],
    });

    infoWindowRef.current = new TMap.InfoWindow({
      map: mapRef.current,
      position: new TMap.LatLng(NANNING_CENTER.lat, NANNING_CENTER.lng),
      content: '',
      offset: { x: 0, y: -38 },
      enableCustom: true,
    });
    infoWindowRef.current.close();

    markerRef.current.on('click', (event: any) => {
      const vehicleId = Number(event.geometry?.id);
      const vehicle = vehicleMapRef.current.get(vehicleId);
      if (!vehicle) {
        return;
      }

      setSelectedVehicleId(vehicleId);
      openVehicleInfo(vehicle, false);
    });

    setMapReady(true);
  }, [openVehicleInfo]);

  const fetchVehicleTrackingData = React.useCallback(async () => {
    const now = Date.now();

    const [vehiclesResult, locationsResult] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, plate_number, terminal_phone')
        .eq('is_active', true)
        .order('plate_number', { ascending: true }),
      supabase
        .from('vehicle_locations')
        .select(`
          vehicle_id,
          terminal_phone,
          latitude,
          longitude,
          speed,
          direction,
          gps_time,
          created_at,
          vehicles!inner (
            id,
            plate_number,
            terminal_phone,
            is_active
          )
        `)
        .eq('vehicles.is_active', true)
        .order('gps_time', { ascending: false }),
    ]);

    if (vehiclesResult.error) {
      throw vehiclesResult.error;
    }

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    const activeVehicles = (vehiclesResult.data ?? []) as ActiveVehicle[];
    const locationRows = (locationsResult.data ?? []) as unknown as LocationRow[];
    const latestLocationMap = new globalThis.Map<number, LocationRow>();

    for (const row of locationRows) {
      if (!latestLocationMap.has(row.vehicle_id)) {
        latestLocationMap.set(row.vehicle_id, row);
      }
    }

    return activeVehicles.map((vehicle) => {
      const latest = latestLocationMap.get(vehicle.id);
      const latitude = parseNumber(latest?.latitude);
      const longitude = parseNumber(latest?.longitude);
      const gpsTime = latest?.gps_time ?? null;
      const gpsMillis = gpsTime ? new Date(gpsTime).getTime() : NaN;
      const isOnline = Number.isFinite(gpsMillis) && now - gpsMillis <= ONLINE_WINDOW_MS;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plate_number,
        terminalPhone: vehicle.terminal_phone,
        latitude,
        longitude,
        speed: parseNumber(latest?.speed),
        direction: parseNumber(latest?.direction),
        gpsTime,
        createdAt: latest?.created_at ?? null,
        isOnline,
        hasLocation: latitude !== null && longitude !== null,
      } satisfies VehicleTrackingItem;
    });
  }, []);

  const loadData = React.useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchVehicleTrackingData();
      setVehicles(data);
      vehicleMapRef.current = new globalThis.Map(data.map((item) => [item.id, item]));
      updateMarkerLayer(data);
      setLastRefreshTime(new Date());

      setSelectedVehicleId((currentId) => {
        if (currentId === null) {
          return currentId;
        }

        const selected = data.find((item) => item.id === currentId);
        if (selected?.hasLocation) {
          openVehicleInfo(selected, false);
          return currentId;
        }

        infoWindowRef.current?.close?.();
        return null;
      });
    } catch (error) {
      console.error('加载车辆定位数据失败:', error);
      toast.error(t('tracking.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchVehicleTrackingData, openVehicleInfo, t, updateMarkerLayer]);

  React.useEffect(() => {
    initializeMap();
    loadData();

    const timer = window.setInterval(() => {
      loadData(true);
    }, REFRESH_INTERVAL);

    return () => {
      window.clearInterval(timer);
      infoWindowRef.current?.destroy?.();
      markerRef.current?.setMap?.(null);
      mapRef.current?.destroy?.();
      infoWindowRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [initializeMap, loadData]);

  const handleVehicleSelect = (vehicle: VehicleTrackingItem) => {
    setSelectedVehicleId(vehicle.id);
    if (!vehicle.hasLocation) {
      toast.error(t('tracking.noAvailableLocation'));
      return;
    }

    openVehicleInfo(vehicle, true);
  };

  const selectedVehicle = selectedVehicleId === null
    ? null
    : vehicles.find((item) => item.id === selectedVehicleId) ?? null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold border-b pb-4 mb-3">{t('tracking.title')}</h1>
            <p className="text-muted-foreground">{t('tracking.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t('tracking.lastRefresh')}</div>
              <div className="text-sm font-medium">
                {lastRefreshTime ? format(lastRefreshTime, 'yyyy-MM-dd HH:mm:ss') : t('tracking.notRefreshed')}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
          </div>
        </div>

        <div className="grid h-[calc(100vh-12rem)] min-h-[640px] grid-cols-[280px_minmax(0,1fr)] gap-6">
          <Card className="flex h-full flex-col overflow-hidden border shadow-sm">
            <div className="border-b p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('tracking.searchPlate')}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('tracking.loading')}</div>
              ) : filteredVehicles.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{t('tracking.noMatches')}</div>
              ) : (
                <div className="divide-y">
                  {filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => handleVehicleSelect(vehicle)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                        selectedVehicleId === vehicle.id && 'bg-[#eef4ff]'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                          vehicle.isOnline ? 'bg-green-500' : 'bg-slate-400'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-foreground">{vehicle.plateNumber}</span>
                          {vehicle.hasLocation ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 border-transparent text-[11px]',
                                vehicle.isOnline ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {vehicle.isOnline ? t('common.online') : t('common.offline')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 border-transparent bg-slate-100 text-[11px] text-slate-500">
                              {t('tracking.noLocation')}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(vehicle.gpsTime, t)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="relative h-full overflow-hidden border shadow-sm">
            <div ref={mapContainerRef} className="h-full w-full bg-slate-100" />

            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapIcon className="h-4 w-4" />
                  {t('tracking.mapLoading')}
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute left-4 top-4 flex gap-2">
              <div className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">{t('tracking.center')}</div>
              {selectedVehicle && (
                <div className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  {t('tracking.selected', { plate: selectedVehicle.plateNumber })}
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 text-xs text-slate-600 shadow-sm">
              <div className="flex items-center gap-2">
                <img src={ONLINE_MARKER} alt="" className="h-6 w-6" />
                <span>{t('tracking.within30')}</span>
              </div>
              <div className="flex items-center gap-2">
                <img src={OFFLINE_MARKER} alt="" className="h-6 w-6" />
                <span>{t('tracking.over30')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span>{t('tracking.latestOnly')}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default VehicleTracking;
