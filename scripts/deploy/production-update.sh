#!/usr/bin/env bash

# 人工触发的生产更新脚本：拉取当前分支、测试、构建、平滑重启并校验健康检查。
# 使用方式：cd /opt/chatbot-main && bash scripts/deploy/production-update.sh

set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PM2_APP="${PM2_APP:-chatbot-server}"
PM2_USER="${PM2_USER:-www}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3001/api/health}"

fail() {
  echo "部署停止：$*" >&2
  exit 1
}

cd "$PROJECT_DIR" || fail "无法进入项目目录：$PROJECT_DIR"

command -v git >/dev/null || fail "未安装 git"
command -v npm >/dev/null || fail "未安装 npm"
command -v pm2 >/dev/null || fail "未安装 pm2"
command -v su >/dev/null || fail "未安装 su"
command -v curl >/dev/null || fail "未安装 curl"

git_repo() {
  git -c safe.directory="$PROJECT_DIR" "$@"
}

pm2_reload() {
  if [[ "$(id -un)" == "$PM2_USER" ]]; then
    pm2 reload "$PM2_APP" --update-env
  else
    su -s /bin/bash "$PM2_USER" -c 'pm2 reload "$1" --update-env' -- "$PM2_APP"
  fi
}

branch="$(git_repo branch --show-current)"
[[ -n "$branch" ]] || fail "当前不在可部署分支上"

if ! git_repo diff --quiet || ! git_repo diff --cached --quiet; then
  fail "服务器工作区存在已跟踪的未提交改动，请先处理后再部署"
fi

if [[ -n "$(git_repo ls-files --others --exclude-standard)" ]]; then
  echo "==> 提示：保留服务器本地未纳管文件；Git 会在文件冲突时停止更新"
fi
git_repo remote get-url origin >/dev/null 2>&1 || fail "未配置 GitHub remote：origin"

previous_commit="$(git_repo rev-parse HEAD)"

echo "==> 拉取 origin/$branch"
git_repo fetch --prune origin "$branch"
git_repo merge --ff-only "origin/$branch"

if [[ "$previous_commit" == "$(git_repo rev-parse HEAD)" ]]; then
  echo "==> 当前已是最新版本，无需构建或重启"
  exit 0
fi

if ! git_repo diff --quiet "$previous_commit" HEAD -- \
  package.json package-lock.json \
  packages/admin/package.json packages/server/package.json packages/widget/package.json; then
  echo "==> 依赖清单已变更，重新安装依赖"
  npm ci --include=dev
fi

echo "==> 运行测试"
npm test

echo "==> 构建发布包"
npm run build

echo "==> 平滑重启 PM2 应用：$PM2_APP"
pm2_reload

echo "==> 健康检查：$HEALTHCHECK_URL"
curl --fail --silent --show-error --max-time 15 "$HEALTHCHECK_URL" >/dev/null \
  || fail "健康检查失败。上一个提交为 $previous_commit；请先检查 pm2 logs $PM2_APP"

echo "==> 部署完成：$(git_repo rev-parse --short HEAD)"
