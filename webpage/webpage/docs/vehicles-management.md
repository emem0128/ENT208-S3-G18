# 车辆管理模块

## 路由

- `/vehicles`：车头列表、筛选、分页、新增车辆
- `/vehicles/trailers`：车挂列表、筛选、分页
- `/vehicles/:id`：车头详情，包含基本信息、证件、关联车挂
- `/vehicles/trailers/:id`：车挂详情，包含基本信息、证件

## Supabase 前置配置

1. 应用迁移 `supabase/migrations/00004_create_vehicles_sorted_view.sql`，创建 `vehicles_sorted` 视图。车头列表会直接查这个视图，并按 `data_source_rank` 排序。
2. Supabase 端需要已有 `trailers_sorted` 视图，车挂列表直接查询该视图，并读取 `current_truck_plate` 展示当前车头。
3. 在 Supabase Dashboard 创建 Storage bucket：
   - `vehicle-documents`
   - `driver-documents`
4. 两个 bucket 都设置为非 public，单文件 5MB，MIME 限制为 `image/jpeg`、`image/png`、`image/webp`。
5. Storage RLS 允许 anon role 读写，但路径必须以 `trucks/`、`trailers/`、`drivers/` 开头。

## 证件路径

- 车头：`trucks/{vehicle_id}/{document_type}.{ext}`
- 车挂：`trailers/{vehicle_id}/{document_type}.{ext}`

扩展名按上传文件原始类型保存，支持 JPG、PNG、WEBP。

车牌包含中文省份简称时，Supabase Storage 会拒绝原始中文 key，所以车辆证件路径使用数据库 ID 作为路径段。

`vehicle_documents.image_url` 只存上述 Storage 路径。前端展示时会调用 `createSignedUrl(path, 3600)` 生成 1 小时有效的签名 URL，不使用公开 URL。
