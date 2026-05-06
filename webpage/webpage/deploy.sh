#!/bin/bash

set -euo pipefail

SERVER_HOST="${SERVER_HOST:-root@YOUR_SERVER_IP}"
SERVER_PATH="${SERVER_PATH:-/root/jt808-server}"
LOCAL_PATH="$(cd "$(dirname "$0")" && pwd)/jt808-server/"

echo "[1/4] 上传代码到服务器: ${SERVER_HOST}:${SERVER_PATH}"
rsync -avz --delete "$LOCAL_PATH" "${SERVER_HOST}:${SERVER_PATH}/"

echo "[2/4] 安装依赖"
ssh "$SERVER_HOST" "cd ${SERVER_PATH} && npm install"

echo "[3/4] 创建日志目录"
ssh "$SERVER_HOST" "mkdir -p /root/logs"

echo "[4/4] 启动并注册 PM2"
ssh "$SERVER_HOST" "cd ${SERVER_PATH} && pm2 start ecosystem.config.js && pm2 save && pm2 startup systemd -u root --hp /root"

echo "部署完成"
