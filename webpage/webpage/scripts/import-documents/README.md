# 证件图片一次性导入

这个目录用于把从 Excel 提取出的司机、车头、车挂证件图片上传到 Supabase Storage，并写入 `driver_documents` / `vehicle_documents`。

## 目录结构

```text
scripts/import-documents/
  README.md
  upload.ts
  vehicle_driver_documents.zip
  extracted/
    drivers/
    trucks/
    trailers/
  driver_image_map.tsv
  truck_image_map.tsv
  trailer_image_map.tsv
```

`vehicle_driver_documents.zip`、`extracted/` 和 `*_image_map.tsv` 是本地导入资料，已被本目录 `.gitignore` 忽略。

## 解压

把 `vehicle_driver_documents.zip` 放到本目录后执行：

```bash
unzip -o vehicle_driver_documents.zip
```

也可以不手动解压。运行导入命令时，如果脚本发现 TSV 不存在，会自动从 `vehicle_driver_documents.zip` 解压输入资料。

压缩包应解出：

- `extracted/drivers/`
- `extracted/trucks/`
- `extracted/trailers/`
- `driver_image_map.tsv`
- `truck_image_map.tsv`
- `trailer_image_map.tsv`

## 运行

从项目根目录执行：

```bash
npm run import:documents
```

脚本会读取项目根目录 `.env` / `.env.local` 中的：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

当前 Node 版本可直接运行 `upload.ts`。如果在旧 Node 环境运行失败，可改用：

```bash
npx tsx scripts/import-documents/upload.ts
```

## 上传路径

- 司机：`driver-documents` bucket，路径 `drivers/{driver_id}/{document_type}.{ext}`
- 车头：`vehicle-documents` bucket，路径 `trucks/{vehicle_id}/{document_type}.{ext}`
- 车挂：`vehicle-documents` bucket，路径 `trailers/{vehicle_id}/{document_type}.{ext}`

车牌包含中文省份简称时，Supabase Storage 会拒绝原始中文 key，所以车辆图片用数据库 ID 作为路径段；数据库仍然只存 Storage 路径。

数据库里的 `image_url` 只存 Storage 路径，不存完整 URL。前端展示时用 `createSignedUrl(path, 3600)` 换取 1 小时签名链接。

## 重跑行为

脚本是幂等的：

- Storage 上传使用 `upsert: true`，同一路径会覆盖。
- 数据库写入使用 upsert conflict key：
  - `driver_documents`: `(driver_id, document_type)`
  - `vehicle_documents`: `(vehicle_kind, vehicle_id, document_type)`

因此重复运行不会插入重复记录。

## 验证

跑完后在客服后台抽查：

- 任意司机详情页应能看到司机证件图。
- 任意车头详情页的“证件”tab 应能看到车头证件图。
- 任意车挂详情页的“证件”tab 应能看到车挂证件图。

脚本会输出每类成功/失败数量，并写出：

- `last-run-report.json`
- `failures.tsv`
