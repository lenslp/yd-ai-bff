# Prisma 配置指南

## 已完成的配置

1. **安装依赖**
   - `@prisma/client`: Prisma 客户端
   - `prisma`: Prisma CLI 工具

2. **配置文件**
   - `prisma/schema.prisma`: Prisma schema 定义
   - `prisma.config.ts`: Prisma 配置文件
   - `.env`: 数据库连接字符串

3. **服务集成**
   - `services/prisma.service.ts`: Prisma 单例服务
   - `services/user.service.ts`: 示例用户服务
   - `routers/UserController.ts`: 示例用户控制器
   - `app.ts`: 已将 Prisma 注册到 Awilix 容器

## 使用方法

### 1. 配置数据库

在 `.env` 文件中配置你的数据库连接：

```env
# PostgreSQL 示例
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# MySQL 示例
# DATABASE_URL="mysql://username:password@localhost:3306/database_name"

# SQLite 示例
# DATABASE_URL="file:./dev.db"
```

### 2. 定义数据模型

在 `prisma/schema.prisma` 中定义你的数据模型：

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3. 生成 Prisma Client

```bash
yarn prisma:generate
```

### 4. 数据库迁移

```bash
# 开发环境创建迁移
yarn prisma:migrate

# 生产环境推送 schema（不创建迁移文件）
yarn prisma:push
```

### 5. 在 Service 中使用

```typescript
import type { PrismaClient } from '@prisma/client';

export default class YourService {
  private prismaClient: PrismaClient;

  constructor({ prismaClient }: { prismaClient: PrismaClient }) {
    this.prismaClient = prismaClient;
  }

  async yourMethod() {
    return await this.prismaClient.yourModel.findMany();
  }
}
```

### 6. 在 Controller 中使用

```typescript
import { route, GET } from 'awilix-koa';
import type YourService from '../services/your.service';

@route('/api/your-route')
export default class YourController {
  private yourService: YourService;

  constructor({ yourService }: { yourService: YourService }) {
    this.yourService = yourService;
  }

  @GET()
  async getData(ctx: Context) {
    const data = await this.yourService.yourMethod();
    ctx.body = { code: 0, data };
  }
}
```

## 可用命令

- `yarn prisma:generate`: 生成 Prisma Client
- `yarn prisma:migrate`: 创建并应用迁移（开发环境）
- `yarn prisma:studio`: 打开 Prisma Studio（数据库 GUI）
- `yarn prisma:push`: 推送 schema 到数据库（无迁移文件）

## Prisma Studio

运行以下命令打开可视化数据库管理界面：

```bash
yarn prisma:studio
```

## 示例 API

已创建示例用户 API：

- `GET /api/users` - 获取所有用户
- `GET /api/users/:email` - 通过邮箱获取用户
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

## 注意事项

1. 生成的 Prisma Client 位于 `./generated/prisma`
2. Prisma Client 已注册到 Awilix 容器，可在所有 Service 中注入使用
3. 记得在 `.gitignore` 中忽略 `.env` 文件
4. 每次修改 schema 后需要运行 `yarn prisma:generate`
5. 在 Lambda 环境中，需要将 `generated/prisma` 打包到部署包中

## 更多信息

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma Schema 参考](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
