require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const tencentcloud = require('tencentcloud-sdk-nodejs-ocr');

const OcrClient = tencentcloud.ocr.v20181119.Client;

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const REGION = process.env.OCR_REGION || 'ap-guangzhou';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
  console.error('❌ 缺少环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
  process.exit(1);
}

const ocrClient = new OcrClient({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: REGION,
  profile: {
    httpProfile: { endpoint: 'ocr.tencentcloudapi.com' },
  },
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      console.warn(`[CORS] 被拒绝的来源: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: `${MAX_FILE_SIZE_MB}mb` }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持图片文件（jpg/png/webp）'));
    }
    cb(null, true);
  },
});

app.get('/api/ocr/health', (req, res) => {
  res.json({ status: 'ok', service: 'ocr-proxy', timestamp: new Date().toISOString() });
});

app.post('/api/ocr/recognize', upload.single('image'), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传图片' });
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const fileSize = req.file.size;
    const fileName = req.file.originalname || 'unknown';

    console.log(`[OCR] 开始识别: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`);

    const response = await ocrClient.GeneralAccurateOCR({
      ImageBase64: imageBase64,
    });

    const textDetections = response.TextDetections || [];
    const recognizedText = textDetections
      .map((item) => item.DetectedText)
      .filter(Boolean)
      .join('\n');

    const elapsed = Date.now() - startTime;
    console.log(
      `[OCR] 完成: ${fileName}, ${textDetections.length} 行, 用时 ${elapsed}ms`
    );

    res.json({
      success: true,
      text: recognizedText,
      lineCount: textDetections.length,
      elapsedMs: elapsed,
      detections: textDetections.map((item) => ({
        text: item.DetectedText,
        confidence: item.Confidence,
      })),
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorCode = error?.code || 'UnknownError';
    const errorMessage = error?.message || String(error);

    console.error(`[OCR] 失败 (${elapsed}ms): ${errorCode} - ${errorMessage}`);

    let statusCode = 500;
    let userMessage = '识别失败，请稍后重试';

    if (errorCode.startsWith('LimitExceeded')) {
      statusCode = 429;
      userMessage = '今日免费额度已用完，请稍后再试或联系管理员';
    } else if (errorCode === 'AuthFailure.SignatureFailure') {
      statusCode = 500;
      userMessage = '服务器配置错误（密钥失效），请联系管理员';
    } else if (errorCode.startsWith('InvalidParameterValue')) {
      statusCode = 400;
      userMessage = '图片格式或大小不符合要求';
    } else if (errorMessage.includes('文件')) {
      statusCode = 400;
      userMessage = errorMessage;
    }

    res.status(statusCode).json({
      success: false,
      error: userMessage,
      errorCode,
    });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: `图片过大，最多支持 ${MAX_FILE_SIZE_MB}MB`,
    });
  }
  console.error('[Error]', err);
  res.status(500).json({ success: false, error: err.message || '服务器错误' });
});

app.listen(PORT, HOST, () => {
  console.log(`✅ OCR Proxy 已启动: http://${HOST}:${PORT}`);
  console.log(`   健康检查: GET /api/ocr/health`);
  console.log(`   识别接口: POST /api/ocr/recognize (multipart/form-data, field: image)`);
  console.log(`   允许来源: ${ALLOWED_ORIGINS.join(', ') || '(无白名单 - 仅同源)'}`);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM，正在关闭服务...');
  process.exit(0);
});
