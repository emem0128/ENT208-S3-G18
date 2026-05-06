import type { OperatingCompany, Vehicle, VehicleDataSource, VehicleDocumentType, VehicleTrailer } from '@/types/database';

export const VEHICLE_PAGE_SIZE = 20;

export const VEHICLE_DOCUMENT_TYPES: Array<{ type: VehicleDocumentType; label: string }> = [
  { type: 'license_front', label: '行驶证正面' },
  { type: 'license_back', label: '行驶证反面' },
  { type: 'green_book_1', label: '绿本 1' },
  { type: 'green_book_2', label: '绿本 2' },
  { type: 'green_book_3', label: '绿本 3' },
];

export const DATA_SOURCE_LABELS: Record<VehicleDataSource, string> = {
  verified: '已核对',
  legacy: '待核对',
  manual: '手动添加',
};

export const DATA_SOURCE_BADGE_CLASS: Record<VehicleDataSource, string> = {
  verified: 'border-transparent bg-[#EAF3DE] text-[#3B6D11]',
  legacy: 'border-transparent bg-[#FAEEDA] text-[#854F0B]',
  manual: 'border-transparent bg-blue-50 text-blue-700',
};

export function companyName(company?: OperatingCompany | null) {
  if (!company) return '-';
  return company.short_name || company.name;
}

export function companyById(companies: OperatingCompany[], id?: number | null) {
  if (!id) return null;
  return companies.find((company) => company.id === id) || null;
}

export function getInspectionWarning(dateValue?: string | null) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return `年审已过期 ${Math.abs(diffDays)} 天`;
  }
  if (diffDays <= 90) {
    return `年审 ${diffDays} 天后到期`;
  }
  return null;
}

export function isTruckReadyToVerify(vehicle: Vehicle) {
  return Boolean(
    vehicle.vin &&
      vehicle.brand &&
      vehicle.model &&
      vehicle.operating_company_id &&
      vehicle.registration_date &&
      vehicle.inspection_expiry
  );
}

export function emptyToNull(value: unknown) {
  return value === '' || value === undefined ? null : value;
}

export function toNullableNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function sanitizePlateNumber(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function fileExtensionForUpload(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName === 'jpg' || fromName === 'jpeg' || fromName === 'png' || fromName === 'webp') {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function validateVehicleImage(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return '只支持 JPG、PNG、WEBP 图片';
  }
  if (file.size > 5 * 1024 * 1024) {
    return '图片不能超过 5MB';
  }
  return null;
}

export function truckTitle(vehicle?: Vehicle | null) {
  if (!vehicle) return '车辆详情';
  return `${vehicle.plate_number}${vehicle.vehicle_model_short ? ` · ${vehicle.vehicle_model_short}` : ''}`;
}

export function trailerTitle(trailer?: VehicleTrailer | null) {
  if (!trailer) return '车挂详情';
  return `${trailer.plate_number}${trailer.vehicle_category ? ` · ${trailer.vehicle_category}` : ''}`;
}
