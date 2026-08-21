# 生产环境一键更新

适用当前宝塔 / PM2 部署：项目目录 `/opt/chatbot-main`，PM2 应用 `chatbot-server`。

## 日常更新

1. 在本地完成测试后，将代码提交并推送到 GitHub 的部署分支。
2. 登录服务器后执行：

   ```bash
   cd /opt/chatbot-main && bash scripts/deploy/production-update.sh
   ```

脚本会自动确认服务器工作区没有未提交改动，并只使用 `git merge --ff-only` 拉取当前分支；之后依次运行测试、构建、PM2 平滑重启与本机健康检查。没有新提交时直接退出，不重启服务。

## 首次检查

在服务器上先确认：

```bash
cd /opt/chatbot-main
git remote -v
git branch --show-current
pm2 status chatbot-server
curl -f http://127.0.0.1:3001/api/health
```

`git branch --show-current` 显示的分支就是脚本将拉取的 GitHub 分支。若需覆盖默认设置，可在命令前传入环境变量：

```bash
PM2_APP=chatbot-server HEALTHCHECK_URL=http://127.0.0.1:3001/api/health bash scripts/deploy/production-update.sh
```

## 安全边界

- 不执行 Prisma 迁移、`db push` 或数据库初始化。
- 不创建、修改或输出 `.env`、密钥和生产配置。
- 依赖清单变化时才执行 `npm ci --include=dev`。
- 测试或构建失败时，不会执行 PM2 重启；请修复问题后重新运行。
- 健康检查失败时，脚本会停止并显示部署前提交号，供人工排查 PM2 日志和回退。

如需回退，请先确认故障原因与目标提交，再由具备服务器权限的人员执行；脚本不会自动执行破坏性的 Git 回退。
