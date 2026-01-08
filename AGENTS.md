# AGENTS.md - Guidelines for AI Coding Agents

This document provides guidelines for AI coding agents operating in this repository.

## Project Overview

**yd-ai-bff** is a Backend-For-Frontend (BFF) service built with:
- **Framework**: Koa + awilix (dependency injection) + EJS (template engine)
- **Database**: Prisma ORM with PostgreSQL
- **Deployment**: AWS Lambda (serverless-http) + AWS SAM / API Gateway
- **Runtime**: Node.js 20+

## Essential Commands

### Development
```bash
yarn                     # Install dependencies
yarn dev                 # Start dev server (port 8081, ts-node-dev with hot reload)
```

### Build & Production
```bash
yarn build               # Compile TypeScript to dist/ + copy assets/views
yarn pm2:start           # Start production with PM2 cluster
bash deploy.sh           # Zero-downtime deploy: git pull → install → build → pm2 reload
```

### Code Quality
```bash
yarn lint                # Biome lint check
yarn format              # Biome format (writes to files)
yarn check               # Biome lint + format check (read-only)
yarn tsc --noEmit        # TypeScript type check
```

### Prisma
```bash
yarn prisma:generate     # Generate Prisma client
yarn prisma:migrate      # Run migrations (dev)
yarn prisma:push         # Push schema to database
yarn prisma:studio       # Open Prisma Studio UI
```

## Code Style Guidelines

### Formatter & Linter
- **Tool**: Biome (configured in `biome.json`)
- **Indent**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes (`'`)
- **Semicolons**: Always
- **Trailing commas**: All

### Imports
```typescript
// Group imports by category, separated by blank lines:
// 1. Node.js built-ins
// 2. External packages
// 3. Relative imports (using @ aliases)
import { join } from 'node:path';
import { route, GET, POST } from 'awilix-koa';
import type { Context } from 'koa';
import type UserService from '@services/user.service';
```

### Path Aliases
The project uses `module-alias` with these aliases:
- `@root` → `__dirname`
- `@interfaces` → `./interface`
- `@config` → `./config`
- `@middlewares` → `./middlewares`

### Naming Conventions
- **Files**: kebab-case (e.g., `user-service.ts`, `api-controller.ts`)
- **Classes**: PascalCase (e.g., `UserController`, `PrismaService`)
- **Variables/functions**: camelCase (e.g., `getAllUsers`, `prismaClient`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_PORT`)
- **Private class members**: prefix with `_` (e.g., `private _prismaClient`)

### TypeScript
- Enable `noImplicitAny: true` and `noImplicitThis: true`
- Use explicit return types for public functions
- Use `import type` for type-only imports
- Avoid `any` - use `unknown` when type is uncertain

### Error Handling
- Controllers must wrap async operations in `try/catch`
- Always return structured responses: `{ code: 0 | -1, data?, message: string }`
- Set appropriate HTTP status codes (400, 404, 500)
- Use `error instanceof Error ? error.message : 'Unknown error'`

### Controller Pattern
```typescript
@route('/api/users')
export default class UserController {
  constructor({ userService }: { userService: UserService }) {}

  @GET()
  async getUsers(ctx: Context) {
    try {
      const users = await this.userService.getAllUsers();
      ctx.body = { code: 0, data: users, message: 'Success' };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: -1, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
```

### Directory Structure
```
├── app.ts               # Koa app entry (local/EC2/ECS)
├── lambda.ts            # Lambda handler entry
├── routers/             # Controllers (awilix-koa decorators)
├── services/            # Business services (DI)
├── middlewares/         # Koa middlewares
├── config/              # Configuration
├── interface/           # TypeScript interfaces
├── views/               # EJS templates
├── assets/              # Static files
├── prisma/              # Prisma schema & migrations
└── generated/prisma/    # Generated Prisma client
```

## Database (Prisma)

- Schema: `prisma/schema.prisma`
- Client output: `generated/prisma/`
- Import: `import { PrismaClient } from '../generated/prisma'`
- Provider: PostgreSQL
- Version: Prisma 5.22.0 (use this version for compatibility)

## Environment Variables

- `PORT`: Server port (default: 8081 dev, 8082 production)
- `NODE_ENV`: Set to `production` for production mode
- `DATABASE_URL`: PostgreSQL connection string (required for Prisma)

## Common Issues

1. **Prisma 7 incompatibility**: Always use Prisma 5.x (current requirement)
2. **Missing DATABASE_URL**: Add to `.env` before running prisma generate
3. **Port in use**: Kill existing processes with `pkill -f ts-node-dev`
4. **Build failures**: Run `yarn check` and `yarn tsc --noEmit` first
