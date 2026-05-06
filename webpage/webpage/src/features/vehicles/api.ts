import { supabase } from '@/lib/supabase';
import type {
  OperatingCompany,
  TruckTrailerAssignment,
  Vehicle,
  VehicleDataSource,
  VehicleDocument,
  VehicleDocumentType,
  VehicleKind,
  VehicleSortedRow,
  VehicleTrailer,
  VehicleType,
} from '@/types/database';
import { fileExtensionForUpload, sanitizePlateNumber, VEHICLE_PAGE_SIZE } from './utils';

export interface VehicleStats {
  activeTrucks: number;
  verifiedTrucks: number;
  legacyTrucks: number;
  activeTrailers: number;
}

export interface TruckListFilters {
  search: string;
  vehicleModelShort: string;
  dataSource: 'all' | VehicleDataSource;
  operatingCompanyId: string;
  page: number;
}

export interface TrailerListFilters {
  search: string;
  operatingCompanyId: string;
  page: number;
}

export interface PaginatedResult<T> {
  rows: T[];
  count: number;
}

export interface ManualTruckInput {
  plate_number: string;
  vehicle_type: VehicleType;
  vehicle_model_short: string;
  vehicle_category?: string | null;
  asset_owner?: string | null;
  operating_company_id?: number | null;
  brand?: string | null;
  model?: string | null;
  terminal_phone?: string | null;
}

export interface VehicleDocumentWithUrl extends VehicleDocument {
  signedUrl?: string | null;
}

const DOCUMENT_BUCKET = 'vehicle-documents';

function applyTruckFilters(query: any, filters: TruckListFilters) {
  let next = query.eq('is_active', true);
  const search = filters.search.trim();
  if (search) {
    next = next.or(`plate_number.ilike.%${search}%,vin.ilike.%${search}%,brand.ilike.%${search}%`);
  }
  if (filters.vehicleModelShort && filters.vehicleModelShort !== 'all') {
    next = next.eq('vehicle_model_short', filters.vehicleModelShort);
  }
  if (filters.dataSource !== 'all') {
    next = next.eq('data_source', filters.dataSource);
  }
  if (filters.operatingCompanyId !== 'all') {
    next = next.eq('operating_company_id', Number(filters.operatingCompanyId));
  }
  return next;
}

function applyTrailerFilters(query: any, filters: TrailerListFilters) {
  let next = query.eq('is_active', true);
  const search = filters.search.trim();
  if (search) {
    next = next.or(`plate_number.ilike.%${search}%,vin.ilike.%${search}%,brand.ilike.%${search}%`);
  }
  if (filters.operatingCompanyId !== 'all') {
    next = next.eq('operating_company_id', Number(filters.operatingCompanyId));
  }
  return next;
}

async function countRows(table: string, configure: (query: any) => any) {
  const { count, error } = await configure(
    (supabase.from(table as any) as any).select('id', { count: 'exact', head: true })
  );
  if (error) throw error;
  return count ?? 0;
}

export async function getVehicleStats(): Promise<VehicleStats> {
  const [activeTrucks, verifiedTrucks, legacyTrucks, activeTrailers] = await Promise.all([
    countRows('vehicles', (query) => query.eq('is_active', true)),
    countRows('vehicles', (query) => query.eq('is_active', true).eq('data_source', 'verified')),
    countRows('vehicles', (query) => query.eq('is_active', true).eq('data_source', 'legacy')),
    countRows('vehicles_trailer', (query) => query.eq('is_active', true)),
  ]);

  return {
    activeTrucks,
    verifiedTrucks,
    legacyTrucks,
    activeTrailers,
  };
}

export async function getOperatingCompanies(): Promise<OperatingCompany[]> {
  const { data, error } = await supabase
    .from('operating_companies')
    .select('*')
    .eq('is_active', true)
    .order('short_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OperatingCompany[];
}

export async function getVehicleModelOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vehicle_model_short')
    .eq('is_active', true)
    .not('vehicle_model_short', 'is', null)
    .order('vehicle_model_short', { ascending: true });

  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row: { vehicle_model_short?: string | null }) => row.vehicle_model_short?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

export async function getTrucks(filters: TruckListFilters): Promise<PaginatedResult<VehicleSortedRow>> {
  const from = (filters.page - 1) * VEHICLE_PAGE_SIZE;
  const to = from + VEHICLE_PAGE_SIZE - 1;
  const query = applyTruckFilters(
    supabase
      .from('vehicles_sorted')
      .select('*', { count: 'exact' })
      .order('data_source_rank', { ascending: true })
      .order('plate_number', { ascending: true }),
    filters
  ).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as VehicleSortedRow[],
    count: count ?? 0,
  };
}

export async function getTrailers(filters: TrailerListFilters): Promise<PaginatedResult<VehicleTrailer>> {
  const from = (filters.page - 1) * VEHICLE_PAGE_SIZE;
  const to = from + VEHICLE_PAGE_SIZE - 1;
  const query = applyTrailerFilters(
    supabase
      .from('trailers_sorted')
      .select('*', { count: 'exact' })
      .order('plate_number', { ascending: true }),
    filters
  ).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as VehicleTrailer[],
    count: count ?? 0,
  };
}

export async function createManualTruck(input: ManualTruckInput): Promise<Vehicle> {
  const payload = {
    ...input,
    plate_number: sanitizePlateNumber(input.plate_number),
    data_source: 'manual' as const,
    is_active: true,
    source: null,
  };

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as Vehicle;
}

export async function getTruck(id: number): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Vehicle | null;
}

export async function getTrailer(id: number): Promise<VehicleTrailer | null> {
  const { data, error } = await supabase
    .from('vehicles_trailer')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as VehicleTrailer | null;
}

export async function updateTruck(id: number, updates: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Vehicle;
}

export async function updateTrailer(id: number, updates: Partial<VehicleTrailer>): Promise<VehicleTrailer> {
  const { data, error } = await supabase
    .from('vehicles_trailer')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as VehicleTrailer;
}

export async function markTruckVerified(id: number): Promise<Vehicle> {
  return updateTruck(id, { data_source: 'verified' });
}

export async function getVehicleDocuments(vehicleKind: VehicleKind, vehicleId: number): Promise<VehicleDocumentWithUrl[]> {
  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_kind', vehicleKind)
    .eq('vehicle_id', vehicleId)
    .order('document_type', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as VehicleDocument[];
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      if (/^https?:\/\//.test(row.image_url)) {
        return { ...row, signedUrl: row.image_url };
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(row.image_url, 60 * 60);
      if (signedError) {
        return { ...row, signedUrl: null };
      }
      return { ...row, signedUrl: signed.signedUrl };
    })
  );

  return withUrls;
}

export async function uploadVehicleDocument(params: {
  vehicleKind: VehicleKind;
  vehicleId: number;
  plateNumber: string;
  documentType: VehicleDocumentType;
  file: File;
}): Promise<VehicleDocument> {
  const folder = params.vehicleKind === 'truck' ? 'trucks' : 'trailers';
  const extension = fileExtensionForUpload(params.file);
  const path = `${folder}/${params.vehicleId}/${params.documentType}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, params.file, {
      cacheControl: '3600',
      contentType: params.file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('vehicle_documents')
    .upsert(
      {
        vehicle_kind: params.vehicleKind,
        vehicle_id: params.vehicleId,
        document_type: params.documentType,
        image_url: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vehicle_kind,vehicle_id,document_type' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as VehicleDocument;
}

export async function getTruckTrailerAssignments(truckId: number): Promise<TruckTrailerAssignment[]> {
  const { data, error } = await supabase
    .from('truck_trailer_assignments')
    .select('*, trailer:vehicles_trailer(*)')
    .eq('truck_id', truckId)
    .order('is_current', { ascending: false })
    .order('assigned_from', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TruckTrailerAssignment[];
}

export async function getAvailableTrailers(currentTruckId: number): Promise<VehicleTrailer[]> {
  const [{ data: trailers, error: trailersError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase
      .from('vehicles_trailer')
      .select('*')
      .eq('is_active', true)
      .order('plate_number', { ascending: true }),
    supabase
      .from('truck_trailer_assignments')
      .select('truck_id,trailer_id')
      .eq('is_current', true),
  ]);

  if (trailersError) throw trailersError;
  if (assignmentsError) throw assignmentsError;

  const occupiedTrailerIds = new Set(
    (assignments ?? [])
      .filter((row: { truck_id: number; trailer_id: number }) => row.truck_id !== currentTruckId)
      .map((row: { trailer_id: number }) => row.trailer_id)
  );

  return ((trailers ?? []) as VehicleTrailer[]).filter((trailer) => !occupiedTrailerIds.has(trailer.id));
}

export async function assignTrailerToTruck(params: {
  truckId: number;
  trailerId: number;
  note?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const { error: closeError } = await supabase
    .from('truck_trailer_assignments')
    .update({
      is_current: false,
      assigned_until: today,
    })
    .eq('truck_id', params.truckId)
    .eq('is_current', true);

  if (closeError) throw closeError;

  const { data, error } = await supabase
    .from('truck_trailer_assignments')
    .insert({
      truck_id: params.truckId,
      trailer_id: params.trailerId,
      assigned_from: today,
      is_current: true,
      note: params.note || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TruckTrailerAssignment;
}
