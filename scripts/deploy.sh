#!/bin/bash
set -e

echo "===== Chatbot 云服务器部署脚本 ====="

# 1. 检查系统
if [ "$EUID" -ne 0 ]; then
  echo "请用 root 用户执行此脚本"
  exit 1
fi

# 2. 安装 Docker（如果未安装）
if ! command -v docker &> /dev/null; then
  echo ">>> 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo ">>> Docker 已安装"
fi

# 3. 检测 Docker Compose 命令（支持 v2 插件和 v1 独立命令）
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
  echo ">>> 使用 Docker Compose 插件 (docker compose)"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
  echo ">>> 使用 Docker Compose (docker-compose)"
else
  echo ">>> 安装 Docker Compose..."
  # 使用国内镜像加速下载
  curl -L "https://mirror.ghproxy.com/https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose || \
  curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  DOCKER_COMPOSE="docker-compose"
fi

# 4. 进入项目目录
PROJECT_DIR="/root/chatbot"
cd "$PROJECT_DIR" || {
  echo ">>> 未找到项目目录 $PROJECT_DIR，请先用 git clone 或 WinSCP 上传代码"
  exit 1
}

# 5. 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
  echo ">>> 创建 .env 文件..."
  cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/chatbot"
DIFY_API_URL="https://api.dify.ai/v1/chat-messages"
DIFY_API_KEY=""
WECOM_WEBHOOK_URL=""
N8N_WEBHOOK_URL="http://n8n:5678/webhook/lead-notify"
N8N_USER=admin
N8N_PASSWORD=admin
PORT=3001
EOF
fi

# 6. 启动服务
echo ">>> 启动 PostgreSQL、Server、n8n..."
$DOCKER_COMPOSE down 2>/dev/null || true
$DOCKER_COMPOSE up -d

# 7. 等待 PostgreSQL 就绪
echo ">>> 等待 PostgreSQL 启动..."
sleep 10
for i in {1..30}; do
  if $DOCKER_COMPOSE exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo ">>> PostgreSQL 已就绪"
    break
  fi
  sleep 2
done

# 8. 初始化数据库表
echo ">>> 推送数据库表结构..."
$DOCKER_COMPOSE exec -T server npx prisma db push --schema=packages/server/prisma/schema.prisma --accept-data-loss

# 9. 初始化站点数据
echo ">>> 初始化默认站点数据..."
$DOCKER_COMPOSE exec -T server node packages/server/prisma/seed.js

# 10. 输出访问信息
PUBLIC_IP=$(curl -s ifconfig.me || echo "你的服务器IP")
echo ""
echo "===== 部署完成 ====="
echo "后端健康检查: http://${PUBLIC_IP}:3001/api/health"
echo "n8n 管理后台: http://${PUBLIC_IP}:5678"
echo "pgAdmin 连接: Host=${PUBLIC_IP} Port=5432 Database=chatbot User=postgres Password=postgres"
echo ""
echo "注意："
echo "1. 请在云平台安全组放行端口 3001、5678、5432"
echo "2. 请在 .env 中配置 DIFY_API_KEY 才能启用真实 AI 回复"
echo "3. 请在 n8n 工作流中替换企微/飞书 webhook URL"
