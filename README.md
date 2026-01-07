# yd-ai-bff

基于 **Koa + awilix(依赖注入) + EJS** 的 BFF（Backend For Frontend）服务，同时提供 **AWS Lambda（serverless-http）** 入口用于通过 **AWS SAM / API Gateway** 部署。

## 功能概览

- 服务端渲染：`GET /` 渲染 `views/index.html`
- 示例 API：`GET /api/list` 返回示例数据
- 统一错误页：`views/404.html`、`views/500.html`

## 技术栈

- Web 框架：Koa
- DI/Controller：awilix、awilix-koa（装饰器路由）
- 模板引擎：@koa/ejs
- 日志：log4js
- Serverless：serverless-http + AWS SAM
- 代码风格：Biome（见 `BIOME.md`）

## 目录结构

- `app.ts`：Koa 应用入口（本地/EC2/ECS 运行）
- `lambda.ts`：Lambda 入口（`export const handler`）
- `routers/`：Controller（awilix-koa decorators）
- `services/`：业务服务（注入到 Controller）
- `middlewares/`：Koa 中间件
- `views/`：EJS 模板与错误页
- `assets/`：静态资源
- `dist/`：`yarn build` 产物（供 PM2 / Lambda 使用）
- `template.yaml`：AWS SAM 模板
- `lambda-build.sh`：SAM 本地/部署脚本（会准备 `layer/`）
- `ecosystem.config.js`：PM2 集群配置

## 环境要求

- Node.js 20+（SAM 模板默认 `nodejs20.x`）
- Yarn
- （可选）PM2：用于生产集群运行
- （可选）AWS SAM CLI + Docker：用于 `sam local` 与打包部署

## 快速开始（本地运行）

```bash
yarn
yarn dev
```

- 默认端口：`8081`（可用 `PORT=xxxx` 覆盖）
- 访问：
  - `GET http://localhost:8081/`
  - `GET http://localhost:8081/api/list`

## 构建

```bash
yarn build
```

说明：

- `yarn build` 实际执行 `./build.sh`：`tsc` 编译到 `dist/`，并复制 `views/`、`assets/`
- 若你需要使用 Lambda Layer（`layer/nodejs`），请确保目录存在（推荐使用 `./lambda-build.sh`，脚本会自动创建）

## 生产运行（PM2）

```bash
yarn build
yarn pm2:start
```

- 入口：`dist/app.js`（见 `ecosystem.config.js`）
- 日志目录：`logs/`（PM2 日志也写入该目录）

## 部署（零停机）

```bash
bash deploy.sh
```

脚本会执行：`git pull` → `yarn install` → `yarn build` → `pm2 reload` → `pm2 save`。

## Lambda / SAM（可选）

```bash
bash lambda-build.sh development
```

- `development`：`sam build` 后执行 `sam local start-api`
- `production` / `test`：`sam build` 后执行 `sam deploy -g`

注意：

- `lambda-build.sh` 会在 `layer/nodejs` 安装生产依赖（用于 SAM 的 `LayerVersion`）
- 如 SAM 构建/部署失败，请先检查 `template.yaml` 中的资源命名与缩进是否与当前项目一致（例如函数名/Outputs 的引用）

如果你更习惯用 `./xxx.sh` 执行脚本，可先运行 `chmod +x deploy.sh lambda-build.sh`。

## 配置

当前代码主要读取以下环境变量：

- `PORT`：端口（默认 `8081`，生产默认 `8082`；详见 `config/index.ts`）
- `NODE_ENV`：`production` 时会启用生产端口与模板缓存策略

项目内包含 `.env.*` 文件占位（例如 `.env.development` / `.env.production`），是否加载取决于你的运行方式（例如通过部署环境注入变量）。

## 代码规范

```bash
yarn lint
yarn format
yarn check
```
