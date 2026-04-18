# 客服后台性能优化与响应时间

## 本次优化代码

1. 首页统计请求并发化（减少等待链路）
- 文件：`src/db/api.ts`
- 位置：`getDashboardStats`
- 优化点：将 5 个统计查询改为 `Promise.all` 并发执行；增加错误显式抛出。

2. 司机月统计改为最小字段查询 + 线性聚合
- 文件：`src/db/api.ts`
- 位置：`getDriverMonthStats`
- 优化点：
  - 由 `select('*')` 改为只取必要字段
  - 由多次 `filter` + `reduce` 改为 `Map` 单次遍历聚合

3. 路由懒加载，降低页面切换阻塞
- 文件：`src/routes.tsx`、`src/App.tsx`
- 优化点：页面组件全部改为 `React.lazy` + `Suspense` 按需加载

4. 高频基础数据缓存（30 秒）
- 文件：`src/db/api.ts`
- 优化点：为 `drivers/vehicles/fee_types/service_staff` 查询增加 TTL 缓存，并在增删改时自动失效。

## 响应时间实测（本地）

- 测试时间：2026-04-17（Asia/Shanghai）
- 环境：本地开发环境，直接请求 Supabase REST
- 口径：
  - `dashboard_ms`：看板统计接口组合并发总耗时（对应 `getDashboardStats`）
  - `driver_stats_ms`：司机月统计接口组合并发总耗时（对应 `getDriverMonthStats`）

| Round | dashboard_ms | driver_stats_ms |
| --- | ---: | ---: |
| 1 | 120.0 | 66.5 |
| 2 | 72.3 | 67.1 |
| 3 | 67.1 | 62.7 |
| 4 | 67.7 | 67.8 |
| 5 | 83.6 | 63.2 |

- 平均耗时：
  - `dashboard_ms`: **82.2 ms**
  - `driver_stats_ms`: **65.4 ms**

## 说明

- 该数据用于反映“后端数据链路 + 查询结构”的当前性能。
- 若要继续降低页面点击延迟，下一步建议在数据库侧补充组合索引（`expense_records` 的 `record_date/status/driver_id`）。
