# OCR 代理服务

腾讯云 OCR 代理服务，用于马上国际管理后台的图片文字识别。

## 技术栈

- Node.js + Express
- 腾讯云 OCR SDK（GeneralAccurateOCR 精准识别）
- PM2 进程管理

## 本地开发

```bash
cp .env.example .env
# 编辑 .env 填入腾讯云 SecretId / SecretKey
npm install
npm run dev
```

健康检查：`curl http://localhost:3001/api/ocr/health`

## 部署到服务器

```bash
chmod +x deploy.sh
./deploy.sh
```

## API 接口

### 健康检查

```
GET /api/ocr/health
```

### 图片识别

```
POST /api/ocr/recognize
Content-Type: multipart/form-data
Field: image (图片文件)
```

响应示例：

```json
{
  "success": true,
  "text": "识别出的文字",
  "lineCount": 5,
  "elapsedMs": 1200,
  "detections": [
    { "text": "第一行", "confidence": 99.5 },
    { "text": "第二行", "confidence": 98.2 }
  ]
}
```

## 服务器配置

Nginx 需要加一段反向代理：

```nginx
location /api/ocr/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 10M;
}
```
