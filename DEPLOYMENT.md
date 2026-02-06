# yd-ai-bff AWS SAM 部署文档

## 目录

1. [概述](#概述)
2. [架构说明](#架构说明)
3. [准备工作](#准备工作)
4. [部署步骤](#部署步骤)
5. [验证部署](#验证部署)
6. [后续更新](#后续更新)
7. [常见问题](#常见问题)
8. [附录](#附录)

---

## 概述

本项目是基于 **Koa + awilix + EJS** 的 BFF 服务，支持 AWS Lambda 无服务器部署。

**部署方式：**
- AWS SAM (Serverless Application Model)
- 运行时：Node.js 20.x
- 架构：ARM64

**核心服务：**
- API Gateway：HTTP 接口入口
- Lambda：运行 Koa 应用
- S3：自动创建（存储部署包）
- RDS PostgreSQL：可选（数据库）

---

## 架构说明

```
客户端请求
    ↓
API Gateway
    ↓
Lambda Function (Koa + serverless-http)
    ↓
Lambda Layer (node_modules 依赖)
    ↓
RDS PostgreSQL (可选)
```

**template.yaml 资源：**
- `Api`: API Gateway，处理 HTTP 请求
- `KoaFunction`: Lambda 函数，运行 `lambda.handler`
- `NodeModulesLayer`: Lambda 层，存放生产依赖

---

## 准备工作

### 一、AWS 账号

1. 访问 https://aws.amazon.com
2. 注册/登录 AWS 账号
3. 需要**信用卡信息**（即使使用免费套餐）

### 二、创建 IAM 用户

#### 步骤 1：进入 IAM

```
AWS 控制台 → 搜索 "IAM" → 左侧菜单 "用户" → 点击 "创建用户"
```

#### 步骤 2：创建用户

```
1. 用户名：iam-lens
2. 勾选：✓ 提供用户访问 AWS Management Console 的权限
3. 点击 "下一步"
```

#### 步骤 3：设置权限

```
1. 选择 "直接附加现有策略"
2. 勾选 "AdministratorAccess"（或给最小权限，见附录）
3. 点击 "下一步"
4. 点击 "创建用户"
```

#### 步骤 4：保存凭证

```
记录以下信息（仅显示一次）：
• 用户登录 URL
• 用户名：iam-lens
• 密码：xxxxxx
```

### 三、获取 Access Key 和 Secret Key

```
1. IAM → 用户 → 点击 "iam-lens"
2. 点击 "安全凭证" 标签
3. 找到 "访问密钥" → 点击 "创建访问密钥"
4. 保存以下信息（仅显示一次）：
   • Access Key ID：AKIAXXXXXXXXXXXXXXXX
   • Secret Access Key：xxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**：立即保存到密码管理器，否则无法找回。

### 四、本地环境准备

#### 1. 安装依赖工具

```bash
# 安装 AWS SAM CLI
brew install awscli 
brew tap aws/tap
brew install aws-sam-cli

# 验证安装
sam --version

# 安装 Docker（用于 sam local）
# https://www.docker.com/products/docker-desktop
```

#### 2. 配置 AWS 凭证

```bash
# 配置 AWS CLI
aws configure

# 输入：
AWS Access Key ID [None]: AKIAXXXXXXXXXXXXXXXX
AWS Secret Access Key [None]: xxxxxxxxxxxxxxxx
Default region name [None]: ap-southeast-1
Default output format [None]: json

# 验证
aws sts get-caller-identity
```

#### 3. 配置环境变量

编辑 `.env` 文件：

```bash
nano .env
```

**不需要数据库时：**
```bash
DATABASE_URL=""
PORT=8081
NODE_ENV=production
```

**需要数据库时：**
```bash
DATABASE_URL="postgresql://admin:password@your-rds-endpoint:5432/postgres"
PORT=8081
NODE_ENV=production
```

---

## 部署步骤

### 步骤 1：创建生产环境文件

```bash
cp .env .env.production
```

### 步骤 2：设置脚本权限

```bash
chmod +x lambda-build.sh
```

### 步骤 3：执行部署

```bash
bash lambda-build.sh production
```

### 步骤 4：SAM 部署交互配置

脚本会自动执行以下步骤，并在 `sam deploy` 时提示配置：

```
Configuring SAM deploy
======================

Stack Name [yd-ai-bff]:                           ✅ 直接回车
AWS Region [ap-southeast-1]:                      ✅ 直接回车
Use an S3 bucket [sam-deploy-bucket-xxx]:         ✅ 直接回车（SAM 自动创建）
Accept default options? [Y/N]: N                  ✅ 输入 N（手动确认）

Capabilities : [CAPABILITY_IAM]                   ✅ 直接回车
Save arguments to samconfig.toml [Y/N]: Y        ✅ 输入 Y
Confirm changes before deploy [y/N]: y            ✅ 输入 y
Allow SAM CLI IAM role creation [Y/N]: Y         ✅ 输入 Y
Disable rollback [y/N]: N                        ✅ 输入 N
```

**等待部署完成**（约 2-5 分钟）

---

## 验证部署

### 1. 获取 API 地址

部署完成后，控制台输出：

```
CloudFormation outputs from deployed stack
----------------------------------------------
Outputs
----------------------------------------------
Key                 ApiEndpoint
Description         API Gateway endpoint URL
Value               https://xxxxx.execute-api.ap-southeast-1.amazonaws.com/dev

Key                 FunctionArn
Description         Lambda Function ARN
Value               arn:aws:lambda:ap-southeast-1:xxxx:function:xxxx
```

### 2. 测试 API

```bash
# 替换成你的 API 地址
API_URL="https://xxxxx.execute-api.ap-southeast-1.amazonaws.com/dev"

# 测试列表接口
curl $API_URL/api/list

# 测试首页
curl $API_URL/
```

### 3. 查看日志

```bash
sam logs -t --stack-name yd-ai-bff
```

### 4. AWS 控制台验证

```
1. CloudFormation → 堆栈 → yd-ai-bff → 查看状态（CREATE_COMPLETE）
2. API Gateway → API → yd-ai-bff-Api-xxx → 阶段 → dev
3. Lambda → 函数 → yd-ai-bff-KoaFunction-xxx
```

---

## 后续更新

### 更新代码后重新部署

```bash
# 拉取最新代码
git pull

# 重新部署
bash lambda-build.sh production
```

### 配置数据库（如果使用 Prisma）

#### 方法一：通过 Lambda 环境变量

```
1. Lambda 控制台 → 函数 → yd-ai-bff-KoaFunction-xxx
2. 点击 "配置" → "环境变量"
3. 点击 "编辑" → 添加：
   - 键：DATABASE_URL
   - 值：postgresql://admin:密码@endpoint:5432/postgres
4. 点击 "保存"
```

#### 方法二：通过 template.yaml

编辑 `template.yaml`：

```yaml
KoaFunction:
  Type: AWS::Serverless::Function
  Properties:
    Environment:
      Variables:
        DATABASE_URL: postgresql://admin:password@endpoint:5432/postgres
```

重新部署：
```bash
sam deploy
```

### 初始化数据库

```bash
# 连接到 RDS 执行迁移
DATABASE_URL="postgresql://admin:密码@endpoint:5432/postgres" yarn prisma:migrate deploy
```

---

## 常见问题

### 1. AWS 凭证错误

**错误信息：**
```
Error: The security token included in the request is invalid.
```

**解决方案：**
```bash
# 重新配置凭证
aws configure
# 或检查 ~/.aws/credentials 文件
```

### 2. SAM 构建失败

**错误信息：**
```
Error: Build failed
```

**解决方案：**
```bash
# 检查依赖是否安装
yarn install

# 检查 TypeScript 编译
yarn build

# 清理后重试
rm -rf dist/ .aws-sam/
bash lambda-build.sh production
```

### 3. Lambda 超时

**错误信息：**
```
Error: Task timed out after 30.00 seconds
```

**解决方案：**

编辑 `template.yaml`，增加超时时间：

```yaml
Globals:
  Function:
    Timeout: 60  # 从 30 改为 60
```

重新部署：
```bash
sam deploy
```

### 4. 数据库连接失败

**错误信息：**
```
Error: Connection refused
```

**解决方案：**
1. 检查 RDS 安全组是否允许 Lambda 访问
2. 检查 `DATABASE_URL` 是否正确
3. 确保 RDS 实例状态为 "可用"

### 5. Prisma 生成失败

**错误信息：**
```
Error: Prisma Client couldn't be generated
```

**解决方案：**
```bash
# 确保使用 Prisma 5.x
yarn prisma:generate

# 重新构建
yarn build
```

### 6. Layer 依赖过大

**错误信息：**
```
Error: Unzipped size must be smaller than 262144000 bytes
```

**解决方案：**

确保使用生产依赖：
```bash
cd layer/nodejs
yarn install --production --frozen-lockfile
cd ../..

# 检查大小
du -sh layer/nodejs/node_modules/
```

---

## 附录

### A. 最小权限 IAM 策略

如果不想给 `AdministratorAccess`，可创建自定义策略：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "iam:PassRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### B. 创建 RDS PostgreSQL

如果需要数据库：

```
1. RDS → 创建数据库
2. 选择引擎：PostgreSQL
3. 模板：免费试用（开发）或生产
4. 数据库实例标识符：yd-ai-bff-db
5. 主用户名：admin
6. 主密码：设置并记录
7. 实例配置：db.t3.micro（免费）或其他
8. 存储：默认
9. 连接：VPC、安全组默认
10. 点击"创建数据库"（5-10分钟）
11. 记录"终端节点"和"端口"
```

**安全组配置：**

```
1. RDS → 数据库 → yd-ai-bff-db → 修改
2. 网络和安全 → 安全组
3. 入站规则 → 添加规则：
   - 类型：自定义 TCP
   - 端口：5432
   - 源：Anywhere (0.0.0.0/0)（开发）或指定 IP（生产）
```

### C. 常用 SAM 命令

```bash
# 构建项目
sam build

# 本地测试
sam local start-api --warm-containers EAGER

# 部署
sam deploy -g

# 查看日志
sam logs -t --stack-name yd-ai-bff

# 查看输出
sam list stack-outputs --stack-name yd-ai-bff

# 删除堆栈
sam delete --stack-name yd-ai-bff

# 本地调用函数
sam local invoke KoaFunction -e event.json
```

### D. 项目目录结构

```
yd-ai-bff/
├── app.ts                 # Koa 应用入口（本地运行）
├── lambda.ts              # Lambda 入口
├── template.yaml          # SAM 模板
├── lambda-build.sh        # 部署脚本
├── deploy.sh             # PM2 部署脚本
├── routers/              # Controller
├── services/             # 业务服务
├── middlewares/          # Koa 中间件
├── views/                # EJS 模板
├── assets/               # 静态资源
├── prisma/               # Prisma Schema
├── layer/                # Lambda Layer（自动生成）
├── dist/                 # 编译输出（自动生成）
├── samconfig.toml        # SAM 配置（自动生成）
└── .aws-sam/            # SAM 构建缓存（自动生成）
```

### E. 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma 数据库连接字符串 | 无 |
| `PORT` | 服务端口 | 8081（开发）、8082（生产） |
| `NODE_ENV` | 运行环境 | development 或 production |
| `AWS_REGION` | AWS 区域 | 从 aws configure 读取 |

### F. 成本估算

**免费套餐（12个月）：**
- Lambda：100 万次/月，400,000 GB-秒/月
- API Gateway：100 万次/月
- CloudWatch：5 GB 日志/月
- S3：5 GB 存储

**超出免费套餐后（估算）：**
- Lambda：¥0.00001683/每 1GB-秒
- API Gateway：¥3.6/每 100 万次
- CloudWatch：¥7.2/每 GB 日志
- RDS：db.t3.micro 约 ¥25-30/月

---

## 支持

遇到问题？

1. 查看日志：`sam logs -t --stack-name yd-ai-bff`
2. 检查 CloudFormation 堆栈状态
3. 查看 Lambda 函数日志
4. 查看 API Gateway 日志

---

**文档版本：** 1.0.0
**最后更新：** 2026-01-16
