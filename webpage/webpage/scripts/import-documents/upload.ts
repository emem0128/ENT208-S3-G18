import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type DriverDocumentType = 'qualification' | 'license_front' | 'license_back' | 'id_card' | 'pass';
type VehicleDocumentType = 'license_front' | 'license_back' | 'green_book_1' | 'green_book_2' | 'green_book_3';
type ImportKind = 'drivers' | 'trucks' | 'trailers';

interface DriverMapRow {
  driver_name: string;
  document_type: DriverDocumentType;
  local_path: string;
  size_kb: string;
}

interface VehicleMapRow {
  plate_number: string;
  document_type: VehicleDocumentType;
  local_path: string;
  size_kb: string;
}

interface ImportFailure {
  kind: ImportKind;
  name: string;
  document_type: string;
  local_path: string;
  reason: string;
}

interface ImportSummary {
  success: number;
  failed: number;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const zipFileName = 'vehicle_driver_documents.zip';
const requiredInputFiles = ['driver_image_map.tsv', 'truck_image_map.tsv', 'trailer_image_map.tsv'];

const driverDocumentTypes = new Set<DriverDocumentType>([
  'qualification',
  'license_front',
  'license_back',
  'id_card',
  'pass',
]);

const vehicleDocumentTypes = new Set<VehicleDocumentType>([
  'license_front',
  'license_back',
  'green_book_1',
  'green_book_2',
  'green_book_3',
]);

function parseEnvFile(content: string) {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadEnv() {
  const values: Record<string, string> = {};
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(repoRoot, fileName);
    if (!existsSync(filePath)) continue;
    Object.assign(values, parseEnvFile(await readFile(filePath, 'utf8')));
  }
  Object.assign(values, process.env);

  const url = values.VITE_SUPABASE_URL;
  const anonKey = values.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，请检查项目根目录 .env / .env.local');
  }

  return { url, anonKey };
}

function parseTsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex]?.trim() ?? '';
    });
    row.__line = String(index + 2);
    return row;
  });
}

async function readTsv<T extends Record<string, string>>(fileName: string): Promise<T[]> {
  const filePath = path.join(scriptDir, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`找不到 ${fileName}，请先解压 vehicle_driver_documents.zip`);
  }
  return parseTsv(await readFile(filePath, 'utf8')) as T[];
}

async function extractZipIfNeeded() {
  const missingInput = requiredInputFiles.some((fileName) => !existsSync(path.join(scriptDir, fileName)));
  if (!missingInput) return;

  const zipPath = path.join(scriptDir, zipFileName);
  if (!existsSync(zipPath)) return;

  console.log(`检测到 TSV 未解压，正在从 ${zipFileName} 解压输入资料...`);
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) {
      await mkdir(path.join(scriptDir, entry.name), { recursive: true });
      continue;
    }

    const targetPath = path.join(scriptDir, entry.name);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, await entry.async('nodebuffer'));
  }
  console.log('解压完成。');
}

async function fetchAll<T>(queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function fullLocalPath(localPath: string) {
  return path.resolve(scriptDir, localPath);
}

function extensionOf(localPath: string) {
  const extension = path.extname(localPath).replace('.', '').toLowerCase();
  if (extension === 'jpeg') return 'jpg';
  if (extension === 'jpg' || extension === 'png' || extension === 'webp') return extension;
  return 'jpg';
}

function contentTypeFor(localPath: string) {
  const extension = extensionOf(localPath);
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function failure(kind: ImportKind, name: string, documentType: string, localPath: string, reason: unknown): ImportFailure {
  const message = reason instanceof Error ? reason.message : String(reason);
  return {
    kind,
    name,
    document_type: documentType,
    local_path: localPath,
    reason: message,
  };
}

function assertLocalFile(localPath: string) {
  const filePath = fullLocalPath(localPath);
  if (!existsSync(filePath)) {
    throw new Error(`本地文件不存在：${localPath}`);
  }
  return filePath;
}

async function uploadBuffer(params: {
  bucket: string;
  storagePath: string;
  filePath: string;
  contentType: string;
}) {
  const body = await readFile(params.filePath);
  const { error } = await supabase.storage.from(params.bucket).upload(params.storagePath, body, {
    contentType: params.contentType,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
}

function printProgress(kind: ImportKind, index: number, total: number, name: string, documentType: string) {
  const label = kind === 'drivers' ? '司机' : kind === 'trucks' ? '车头' : '车挂';
  console.log(`[${label} ${index}/${total}] ${name} / ${documentType}`);
}

await extractZipIfNeeded();

const env = await loadEnv();
const supabase = createClient(env.url, env.anonKey, {
  auth: {
    persistSession: false,
  },
});

console.log('读取 Supabase 映射...');
const [drivers, trucks, trailers] = await Promise.all([
  fetchAll<{ id: number; name: string }>((from, to) =>
    supabase.from('drivers').select('id,name').range(from, to)
  ),
  fetchAll<{ id: number; plate_number: string }>((from, to) =>
    supabase.from('vehicles').select('id,plate_number').range(from, to)
  ),
  fetchAll<{ id: number; plate_number: string }>((from, to) =>
    supabase.from('vehicles_trailer').select('id,plate_number').range(from, to)
  ),
]);

const driverIdByName = new Map(drivers.map((driver) => [driver.name, driver.id]));
const truckIdByPlate = new Map(trucks.map((truck) => [truck.plate_number, truck.id]));
const trailerIdByPlate = new Map(trailers.map((trailer) => [trailer.plate_number, trailer.id]));

console.log(`司机 ${driverIdByName.size} 个，车头 ${truckIdByPlate.size} 个，车挂 ${trailerIdByPlate.size} 个`);

const failures: ImportFailure[] = [];
const summary: Record<ImportKind, ImportSummary> = {
  drivers: { success: 0, failed: 0 },
  trucks: { success: 0, failed: 0 },
  trailers: { success: 0, failed: 0 },
};

async function importDriverDocuments() {
  const rows = await readTsv<DriverMapRow>('driver_image_map.tsv');
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const name = row.driver_name;
    const documentType = row.document_type;
    printProgress('drivers', index + 1, rows.length, name, documentType);

    try {
      if (!driverDocumentTypes.has(documentType)) {
        throw new Error(`未知司机 document_type：${documentType}`);
      }

      const driverId = driverIdByName.get(name);
      if (!driverId) {
        throw new Error(`数据库未找到司机：${name}`);
      }

      const filePath = assertLocalFile(row.local_path);
      const extension = extensionOf(row.local_path);
      const storagePath = `drivers/${driverId}/${documentType}.${extension}`;

      await uploadBuffer({
        bucket: 'driver-documents',
        storagePath,
        filePath,
        contentType: contentTypeFor(row.local_path),
      });

      const { error } = await supabase
        .from('driver_documents')
        .upsert(
          {
            driver_id: driverId,
            document_type: documentType,
            image_url: storagePath,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id,document_type' }
        );
      if (error) throw error;

      summary.drivers.success += 1;
    } catch (error) {
      summary.drivers.failed += 1;
      failures.push(failure('drivers', name, documentType, row.local_path, error));
      console.log(`  失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importTruckDocuments() {
  const rows = await readTsv<VehicleMapRow>('truck_image_map.tsv');
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const plateNumber = row.plate_number;
    const documentType = row.document_type;
    printProgress('trucks', index + 1, rows.length, plateNumber, documentType);

    try {
      if (!vehicleDocumentTypes.has(documentType)) {
        throw new Error(`未知车辆 document_type：${documentType}`);
      }

      const vehicleId = truckIdByPlate.get(plateNumber);
      if (!vehicleId) {
        throw new Error(`数据库未找到车头：${plateNumber}`);
      }

      const filePath = assertLocalFile(row.local_path);
      const extension = extensionOf(row.local_path);
      const storagePath = `trucks/${vehicleId}/${documentType}.${extension}`;

      await uploadBuffer({
        bucket: 'vehicle-documents',
        storagePath,
        filePath,
        contentType: contentTypeFor(row.local_path),
      });

      const { error } = await supabase
        .from('vehicle_documents')
        .upsert(
          {
            vehicle_kind: 'truck',
            vehicle_id: vehicleId,
            document_type: documentType,
            image_url: storagePath,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'vehicle_kind,vehicle_id,document_type' }
        );
      if (error) throw error;

      summary.trucks.success += 1;
    } catch (error) {
      summary.trucks.failed += 1;
      failures.push(failure('trucks', plateNumber, documentType, row.local_path, error));
      console.log(`  失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importTrailerDocuments() {
  const rows = await readTsv<VehicleMapRow>('trailer_image_map.tsv');
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const plateNumber = row.plate_number;
    const documentType = row.document_type;
    printProgress('trailers', index + 1, rows.length, plateNumber, documentType);

    try {
      if (!vehicleDocumentTypes.has(documentType)) {
        throw new Error(`未知车辆 document_type：${documentType}`);
      }

      const vehicleId = trailerIdByPlate.get(plateNumber);
      if (!vehicleId) {
        throw new Error(`数据库未找到车挂：${plateNumber}`);
      }

      const filePath = assertLocalFile(row.local_path);
      const extension = extensionOf(row.local_path);
      const storagePath = `trailers/${vehicleId}/${documentType}.${extension}`;

      await uploadBuffer({
        bucket: 'vehicle-documents',
        storagePath,
        filePath,
        contentType: contentTypeFor(row.local_path),
      });

      const { error } = await supabase
        .from('vehicle_documents')
        .upsert(
          {
            vehicle_kind: 'trailer',
            vehicle_id: vehicleId,
            document_type: documentType,
            image_url: storagePath,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'vehicle_kind,vehicle_id,document_type' }
        );
      if (error) throw error;

      summary.trailers.success += 1;
    } catch (error) {
      summary.trailers.failed += 1;
      failures.push(failure('trailers', plateNumber, documentType, row.local_path, error));
      console.log(`  失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function countRows(tableName: string) {
  const { count, error } = await supabase.from(tableName).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

await importDriverDocuments();
await importTruckDocuments();
await importTrailerDocuments();

const [driverDocumentsCount, vehicleDocumentsCount] = await Promise.all([
  countRows('driver_documents'),
  countRows('vehicle_documents'),
]);

const report = {
  finished_at: new Date().toISOString(),
  summary,
  database_counts: {
    driver_documents: driverDocumentsCount,
    vehicle_documents: vehicleDocumentsCount,
  },
  failures,
};

await writeFile(path.join(scriptDir, 'last-run-report.json'), JSON.stringify(report, null, 2), 'utf8');

const failureLines = [
  'kind\tname\tdocument_type\tlocal_path\treason',
  ...failures.map((item) =>
    [item.kind, item.name, item.document_type, item.local_path, item.reason.replace(/\s+/g, ' ')].join('\t')
  ),
];
await writeFile(path.join(scriptDir, 'failures.tsv'), `${failureLines.join('\n')}\n`, 'utf8');

console.log('\n=== 导入汇总 ===');
console.log(`司机：成功 ${summary.drivers.success}，失败 ${summary.drivers.failed}`);
console.log(`车头：成功 ${summary.trucks.success}，失败 ${summary.trucks.failed}`);
console.log(`车挂：成功 ${summary.trailers.success}，失败 ${summary.trailers.failed}`);
console.log(`driver_documents 总行数：${driverDocumentsCount}`);
console.log(`vehicle_documents 总行数：${vehicleDocumentsCount}`);

if (failures.length > 0) {
  console.log('\n失败明细：');
  for (const item of failures) {
    console.log(`- ${item.kind} ${item.name} / ${item.document_type}: ${item.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n全部完成，没有失败记录。');
}
