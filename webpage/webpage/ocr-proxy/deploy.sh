#!/bin/bash
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-root@119.91.129.106}"
SERVER_PATH="${SERVER_PATH:-/root/ocr-proxy}"
LOCAL_PATH="$(cd "$(dirname "$0")" && pwd)/"

echo "[1/5] 上传代码到服务器: ${SERVER_HOST}:${SERVER_PATH}"
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  "$LOCAL_PATH" "${SERVER_HOST}:${SERVER_PATH}/"

echo "[2/5] 检查 .env 文件是否存在"
if ! ssh "$SERVER_HOST" "test -f ${SERVER_PATH}/.env"; then
  echo "⚠️  服务器上没有 .env 文件！"
  echo "请先运行：ssh ${SERVER_HOST}"
  echo "  cp ${SERVER_PATH}/.env.example ${SERVER_PATH}/.env"
  echo "  vim ${SERVER_PATH}/.env  # 填入腾讯云 SecretId/SecretKey"
  exit 1
fi

echo "[3/5] 安装依赖"
ssh "$SERVER_HOST" "cd ${SERVER_PATH} && npm install --production"

echo "[4/5] 创建日志目录"
ssh "$SERVER_HOST" "mkdir -p /root/logs"

echo "[5/5] 启动 / 重启 PM2"
ssh "$SERVER_HOST" "cd ${SERVER_PATH} && pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js"
ssh "$SERVER_HOST" "pm2 save"

echo ""
echo "✅ 部署完成！测试一下："
echo "  curl http://119.91.129.106/api/ocr/health"
