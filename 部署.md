# 部署指南

本文档详细说明如何使用 AWS SAM 将 yd-ai-bff 项目部署到生产环境。

## 目录

1. [部署架构概览](#部署架构概览)
2. [SAM 部署流程](#sam-部署流程)
3. [VPC 与网络配置](#vpc-与网络配置)
4. [Lambda VPC 配置](#lambda-vpc-配置)
5. [安全组配置](#安全组配置)
6. [IAM 权限配置](#iam-权限配置)
7. [路由表配置](#路由表配置)
8. [VPC Endpoint](#vpc-endpoint)
9. [域名与 HTTPS 配置](#域名与-https-配置)
10. [部署检查清单](#部署检查清单)
11. [常见问题](#常见问题)

---

## 部署架构概览

```
                              Internet
                                 │
                    ┌────────────┴────────────┐
                    │    Route53 + ACM        │  ← DNS 解析 + SSL 证书
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      API Gateway        │  ← 公网入口，无需 VPC
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │   可用区 1      │ │   可用区 2      │ │   可用区 3      │
     └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
             │                  │                  │
     ┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
     │  公有子网 1      │ │  公有子网 2      │ │  公有子网 3      │
     │  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
     │  │ NAT GW    │  │ │  │ NAT GW    │  │ │  │ NAT GW    │  │
     │  │ (有 EIP)  │  │ │  │ (有 EIP)  │  │ │  │ (有 EIP)  │  │
     │  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
     └─────────────────┘ └─────────────────┘ └─────────────────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                │
     ┌──────────────────────────┼──────────────────────────┐
     │                          ▼                          │
     │              ┌─────────────────────────┐            │
     │              │      VPC 本地路由        │            │
     │              │      10.0.0.0/16        │            │
     │              └─────────────────────────┘            │
     │                          │                          │
     │     ┌────────────────────┼────────────────────┐     │
     │     │                    │                    │     │
     ▼     ▼                    ▼                    ▼     ▼
┌───────────┐         ┌───────────┐         ┌───────────┐
│ 私有子网 1 │         │ 私有子网 2 │         │ 私有子网 3 │
│ ┌───────┐ │         │ ┌───────┐ │         │ ┌───────┐ │
│ │ Lambda│ │         │ │ Lambda│ │         │ │ Lambda│ │
│ └───────┘ │         │ └───────┘ │         │ └───────┘ │
│ ┌───────┐ │         │ ┌───────┐ │         │ ┌───────┐ │
│ │  RDS  │ │         │ │ Redis │ │         │ │ 其他  │ │
│ └───────┘ │         │ └───────┘ │         │ └───────┘ │
└───────────┘         └───────────┘         └───────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │      VPC Endpoint       │
                    │   (S3 / DynamoDB)       │  ← 直连 AWS 服务，不走公网
                    └─────────────────────────┘
```

### 流量走向总览

| 流量类型 | 路径 | 需要的组件 |
|----------|------|------------|
| 用户请求 | Internet → Route53 → API Gateway → Lambda | 无需 VPC |
| 访问 RDS | Lambda (VPC) → RDS | VPC + 安全组 |
| 访问外部 API | Lambda (VPC) → NAT → Internet | NAT Gateway |
| 访问 S3 | Lambda (VPC) → S3 Endpoint | VPC Endpoint |
| 访问公网 API | Lambda (VPC) → NAT → Internet | NAT Gateway |

---

## SAM 部署流程

### 1. CloudFormation 堆栈

使用 `sam deploy` 命令部署时，SAM 会自动创建 CloudFormation 堆栈：

```bash
sam deploy --guided
```

部署过程中会提示输入堆栈名称，SAM 会将配置保存到本地 `samconfig.toml`。

### 2. 分配的 Serverless 资源

部署完成后会自动创建以下资源：

#### Lambda 函数
- **NestjsFunction**: 项目的核心函数
- **Handler**: `lambda.handler`
- **Layer**: `NodeModulesLayer`（包含所有依赖，减少包体积）

#### API Gateway
- **Type**: AWS::Serverless::Api
- **Path**: `/{proxy+}`（匹配所有路径）
- **Method**: `ANY`（支持所有 HTTP 方法）
- **Integration**: Lambda 集成

### 3. Binary Media Types 配置

在 `sam template.yml` 中配置二进制媒体类型支持：

```yaml
Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    Layers:
      - !Ref NodeModulesLayer

Api:
  Type: AWS::Serverless::Api
  Properties:
    StageName: prod
    BinaryMediaTypes:
      - 'image/*'
      - 'multipart/form-data'
```

### 4. Lambda VPC 配置（可选）

**重要**：Lambda 默认不在 VPC 中，可以直接访问公网。

```yaml
NestjsFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub '${ProjectName}-nestjs-${Environment}'
    CodeUri: dist/
    Handler: lambda.handler
    Timeout: 30
    Runtime: nodejs20.x
    Layers:
      - !Ref NodeModulesLayer
    VpcConfig:
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
        - !Ref PrivateSubnet3
    Environment:
      Variables:
        DATABASE_URL: !Sub 'postgres://${DbUser}:${DbPassword}@${DbHost}:5432/${DbName}'
        NODE_ENV: prod
```

### 5. 部署阶段配置

部署时需要指定：
- **StageName**: `dev` 或 `prod`
- **HTTPS 证书**: 通过 AWS Certificate Manager 配置

---

## VPC 与网络配置

### VPC 概念

**VPC (Virtual Private Cloud)** 是 AWS 中的虚拟私有云，可以理解为在公有云中创建的"自己单独的内网 + 私有机房"。

### 子网 (Subnet)

子网是将 VPC 的 IP 地址段划分为更小的网络分区，用于分组管理资源。

#### 子网类型

| 类型 | 公网访问 | 用途 |
|------|----------|------|
| **公有子网** | 可直接访问公网（通过 IGW） | NAT Gateway、负载均衡器节点 |
| **私有子网** | 不可直接访问公网 | Lambda 函数、数据库 |

#### 推荐配置

```yaml
# 3 可用区 × 2 子网类型 = 6 个子网
Resources:
  # 公有子网
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true

  PublicSubnet3:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [2, !GetAZs '']
      CidrBlock: 10.0.3.0/24
      MapPublicIpOnLaunch: true

  # 私有子网
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.101.0/24

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.102.0/24

  PrivateSubnet3:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      AvailabilityZone: !Select [2, !GetAZs '']
      CidrBlock: 10.0.103.0/24
```

### Internet Gateway (IGW)

- 让**公有子网**资源直接连公网
- 资源必须有公网 IP（弹性公网 IP）
- 公网可以主动访问该资源

### NAT Gateway

- 让**私有子网**资源**只出不进**访问公网
- 对外统一使用 NAT 的公网 IP
- 外部无法主动连接私有资源
- **必须部署在公有子网**

```yaml
NatGateway1:
  Type: AWS::EC2::NatGateway
  Properties:
    AllocationId: !GetAtt EIP1.AllocationId
    SubnetId: !Ref PublicSubnet1
    Tags:
      - Key: Name
        Value: !Sub '${ProjectName}-nat-gw-1'

NatGateway2:
  Type: AWS::EC2::NatGateway
  Properties:
    AllocationId: !GetAtt EIP2.AllocationId
    SubnetId: !Ref PublicSubnet2
    Tags:
      - Key: Name
        Value: !Sub '${ProjectName}-nat-gw-2'

NatGateway3:
  Type: AWS::EC2::NatGateway
  Properties:
    AllocationId: !GetAtt EIP3.AllocationId
    SubnetId: !Ref PublicSubnet3
    Tags:
      - Key: Name
        Value: !Sub '${ProjectName}-nat-gw-3'
```

---

## Lambda VPC 配置

### 关键决策点

| 场景 | Lambda 位置 | 需要的组件 |
|------|-------------|------------|
| **只访问外部 API** | 默认（无 VPC） | 无 |
| **需要访问 RDS** | VPC 私有子网 | VPC + 安全组 |
| **需要访问 RDS + 外部 API** | VPC 私有子网 | VPC + NAT Gateway |
| **需要访问 RDS + S3** | VPC 私有子网 | VPC + S3 Endpoint |

### 为什么默认不放 VPC？

```
Lambda 默认状态：
┌─────────────────────────────────────────────────────────┐
│  Lambda（无 VPC）                                        │
│  ├── ✓ 访问公网 API（OpenAI、Claude）                    │
│  ├── ✗ 不能访问 RDS（除非开启公网访问，危险！）           │
│  ├── ✓ 访问 S3（通过公网）                               │
│  ├── ✓ 冷启动快（无需初始化 ENI）                         │
│  └── ✗ 无法配置安全组（只能依赖资源策略）                  │
└─────────────────────────────────────────────────────────┘
```

```
Lambda 放入 VPC 后：
┌─────────────────────────────────────────────────────────┐
│  Lambda（VPC 私有子网）                                  │
│  ├── ✓ 访问 RDS（内网连接，安全）                         │
│  ├── ✗ 不能访问公网（除非配置 NAT Gateway）              │
│  ├── ✓ 访问 S3（通过 VPC Endpoint，直连内网）            │
│  ├── ✗ 冷启动慢（需要创建 ENI，10-60秒）                  │
│  └── ✓ 可以配置安全组                                    │
└─────────────────────────────────────────────────────────┘
```

### 配置建议

```yaml
# 推荐配置：VPC + NAT Gateway + S3 Endpoint
# 优点：安全访问 RDS + 能访问外部 API + S3 直连内网
# 缺点：冷启动较慢（约 10-60 秒）

NestjsFunction:
  Type: AWS::Serverless::Function
  Properties:
    VpcConfig:
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
        - !Ref PrivateSubnet3
```

---

## 安全组配置

安全组是虚拟防火墙，用于控制资源的入站和出站流量。

### 架构

```
                    ┌────────────────────────────────────────────┐
                    │           Lambda 安全组                     │
                    │  出站: 允许所有 (0.0.0.0/0)                 │
                    └─────────────────┬──────────────────────────┘
                                      │
                                      ▼
                    ┌────────────────────────────────────────────┐
                    │           RDS 安全组                        │
                    │  入站: 5432 ← Lambda 安全组 ID              │
                    │  出站: 允许所有 (0.0.0.0/0)                 │
                    └────────────────────────────────────────────┘
```

### 安全组配置

```yaml
# Lambda 安全组
LambdaSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for Lambda function
    VpcId: !Ref MyVPC
    SecurityGroupEgress:
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        DestinationSecurityGroupId: !Ref DatabaseSecurityGroup

# 数据库安全组
DatabaseSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for RDS PostgreSQL
    VpcId: !Ref MyVPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 5432
        ToPort: 5432
        SourceSecurityGroupId: !Ref LambdaSecurityGroup
```

### 注意事项

1. **VPC 一致性**: 创建安全组时，安全组的 VPC ID 必须与数据库的 VPC ID 一致
2. **最小权限**: 只开放必要的端口和 IP 范围
3. **禁止数据库公网访问**: RDS 必须在内网，不允许 0.0.0.0/0 访问
4. **安全组引用**: 使用 `SourceSecurityGroupId` 引用其他安全组

---

## IAM 权限配置

### Role 配置

为 Lambda 函数创建 IAM Role，分配必要的权限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": "arn:aws:rds-db:region:account:dbuser:db-instance-id/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:region:account:secret:db-credentials-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:region:account:log-group:/aws/lambda/*"
    }
  ]
}
```

### 常见权限

| 服务 | 所需权限 | 说明 |
|------|----------|------|
| **S3** | `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` | 存储文件 |
| **RDS** | `rds-db:connect` | 连接数据库 |
| **Secrets Manager** | `secretsmanager:GetSecretValue` | 获取密钥 |
| **CloudWatch** | `logs:*` | 日志管理 |
| **EC2** | `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface` | VPC 必需 |

---

## 路由表配置

### 公有子网路由表

```yaml
PublicRouteTable:
  Type: AWS::EC2::RouteTable
  Properties:
    VpcId: !Ref MyVPC

DefaultPublicRoute:
  Type: AWS::EC2::Route
  DependsOn: InternetGatewayAttachment
  Properties:
    RouteTableId: !Ref PublicRouteTable
    DestinationCidrBlock: 0.0.0.0/0
    GatewayId: !Ref InternetGateway
```

### 私有子网路由表

```yaml
PrivateRouteTable1:
  Type: AWS::EC2::RouteTable
  Properties:
    VpcId: !Ref MyVPC

DefaultPrivateRoute1:
  Type: AWS::EC2::Route
  Properties:
    RouteTableId: !Ref PrivateRouteTable1
    DestinationCidrBlock: 0.0.0.0/0
    NatGatewayId: !Ref NatGateway1
```

### 路由规则汇总

| 子网类型 | 目标 | 路由 | 说明 |
|----------|------|------|------|
| 公有子网 | 10.0.0.0/16 | 本地 | VPC 内网互通 |
| 公有子网 | 0.0.0.0/0 | IGW | 访问公网 |
| 私有子网 | 10.0.0.0/16 | 本地 | VPC 内网互通 |
| 私有子网 | 0.0.0.0/0 | NAT Gateway | 访问公网（只出不进） |

### 流量走向图

```
┌─────────────────────────────────────────────────────────────────┐
│                         流量走向详解                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ① 用户请求（公网 → Lambda）：                                     │
│  ┌─────────┐     ┌─────────────┐     ┌─────────┐                │
│  │  用户   │────►│ API Gateway │────►│  Lambda │                │
│  └─────────┘     └─────────────┘     │(默认 VPC)│                │
│                                      └─────────┘                │
│  ✓ 路径：公网 → API Gateway → Lambda                             │
│  ✓ 不需要 VPC 配置                                               │
│                                                                  │
│  ② Lambda 访问 RDS（内网）：                                       │
│  ┌─────────┐     ┌─────────┐     ┌─────────────┐                │
│  │  Lambda │────►│ 内网    │────►│     RDS     │                │
│  │(VPC)    │     │ 路由    │     │             │                │
│  └─────────┘     └─────────┘     └─────────────┘                │
│  ✓ 路径：Lambda → 私有子网 → RDS                                  │
│  ✓ 前提：Lambda 在 VPC + 安全组允许                               │
│                                                                  │
│  ③ Lambda 访问外部 API（公网）：                                   │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐   │
│  │  Lambda │────►│ NAT GW  │────►│   IGW   │────►│  公网   │   │
│  │(VPC)    │     │(公有子网)│     │         │     │  API    │   │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘   │
│  ✓ 路径：Lambda → NAT → IGW → 公网                                │
│  ✓ 特点：只出不进，外部无法主动连接 Lambda                         │
│                                                                  │
│  ④ Lambda 访问 S3（内网直连）：                                    │
│  ┌─────────┐     ┌─────────────────┐                            │
│  │  Lambda │────►│  S3 Endpoint    │                            │
│  │(VPC)    │     │  (VPC 内部)     │                            │
│  └─────────┘     └─────────────────┘                            │
│  ✓ 路径：Lambda → VPC Endpoint → S3                              │
│  ✓ 优点：不走公网，速度快，节省流量费                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## VPC Endpoint

### 为什么需要 VPC Endpoint？

```
Without Endpoint:                    With Endpoint:
┌─────────────┐                      ┌─────────────┐
│  Lambda     │                      │  Lambda     │
│  (VPC)      │                      │  (VPC)      │
└──────┬──────┘                      └──────┬──────┘
       │                                  │
       │  公网路由                         │  内网路由
       ▼                                  ▼
┌─────────────┐                      ┌─────────────────┐
│  Internet   │                      │  S3 Endpoint    │
│  (走 NAT)   │                      │  (VPC 内部)     │
└─────────────┘                      └────────┬────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌─────────────┐
│     S3      │                      │     S3      │
└─────────────┘                      └─────────────┘

❌ 费用：NAT Gateway $0.065/小时 + 流量费     ✓ 费用：仅 S3 请求费
❌ 速度：经过公网，延迟高                      ✓ 速度：内网直连，延迟低
❌ 复杂：需要 NAT + 路由表                     ✓ 简单：配置即用
```

### S3 Endpoint 配置

```yaml
S3VPCEndpoint:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref MyVPC
    ServiceName: !Sub 'com.amazonaws.${AWS::Region}.s3'
    RouteTableIds:
      - !Ref PrivateRouteTable1
      - !Ref PrivateRouteTable2
      - !Ref PrivateRouteTable3
    VpcEndpointType: Gateway
```

### DynamoDB Endpoint（可选）

```yaml
DynamoDBVPCEndpoint:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref MyVPC
    ServiceName: !Sub 'com.amazonaws.${AWS::Region}.dynamodb'
    RouteTableIds:
      - !Ref PrivateRouteTable1
      - !Ref PrivateRouteTable2
      - !Ref PrivateRouteTable3
    VpcEndpointType: Gateway
```

---

## 域名与 HTTPS 配置

### 1. 申请 SSL 证书

通过 AWS Certificate Manager 申请证书：

1. 进入 AWS ACM 控制台
2. 请求证书
3. 输入域名：`api.yourdomain.com` 和 `*.yourdomain.com`
4. 选择 DNS 验证
5. 在 Route53 中创建验证记录

```yaml
# ACM 证书（需要手动创建，获取 ARN）
Parameters:
  DomainCertificateArn:
    Type: String
    Description: ACM Certificate ARN for custom domain
```

### 2. 配置 API Gateway 域名

```yaml
ApiGateway:
  Type: AWS::Serverless::Api
  Properties:
    StageName: prod
    Domain:
      DomainName: api.yourdomain.com
      CertificateArn: !Ref DomainCertificateArn
      Route53:
        SetId: api.yourdomain.com
        HostedZoneId: !Ref HostedZoneId
```

### 3. Route53 DNS 配置

```yaml
ApiRecordSet:
  Type: AWS::Route53::RecordSet
  Properties:
    HostedZoneId: !Ref HostedZoneId
    Name: api.yourdomain.com.
    Type: A
    AliasTarget:
      DNSName: !GetAtt ApiGateway.RegionalDomainName
      HostedZoneId: !GetAtt ApiGateway.RegionalHostedZoneId
      EvaluateTargetHealth: true
```

### 访问流程

```
用户访问: https://api.yourdomain.com/users

DNS 解析:
  api.yourdomain.com → Route53 → API Gateway

HTTPS 握手:
  客户端 → ACM 证书验证 → API Gateway

请求路由:
  API Gateway → /users → Lambda 函数

响应返回:
  Lambda → API Gateway → 用户
```

---

## 部署检查清单

### 部署前

- [ ] **VPC 配置**
  - [ ] 3 个可用区
  - [ ] 3 个公有子网 + 3 个私有子网
  - [ ] Internet Gateway 创建并关联

- [ ] **NAT Gateway**
  - [ ] 每个公有子网部署一个 NAT Gateway
  - [ ] 分配弹性 IP
  - [ ] 私有子网路由表指向对应 NAT Gateway

- [ ] **安全组**
  - [ ] Lambda 安全组（允许出站）
  - [ ] RDS 安全组（仅允许 Lambda 安全组访问 5432）

- [ ] **IAM Role**
  - [ ] Lambda 执行角色
  - [ ] RDS 连接权限
  - [ ] S3 访问权限
  - [ ] CloudWatch 日志权限

- [ ] **VPC Endpoint**
  - [ ] S3 Gateway Endpoint（私有子网路由表）

- [ ] **证书**
  - [ ] ACM 证书申请并验证通过
  - [ ] 证书 ARN 准备好

- [ ] **环境变量**
  - [ ] DATABASE_URL
  - [ ] 其他 API keys

### 部署后

- [ ] 执行 `sam build`
- [ ] 执行 `sam deploy`
- [ ] **验证 RDS 连接**
  ```bash
  # 在 Lambda 中测试
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  await prisma.$connect();
  ```
- [ ] **验证外部 API 访问**
  ```bash
  # 确认 NAT Gateway 路由正确
  curl https://api.openai.com/v1/models
  ```
- [ ] **验证 S3 访问**
  ```bash
  # 确认 VPC Endpoint 生效
  aws s3 ls s3://your-bucket-name
  ```
- [ ] **检查 CloudWatch 日志**
  - [ ] 无连接超时错误
  - [ ] 无权限拒绝错误

---

## 常见问题

### Q1: Lambda 无法访问数据库

**可能原因**:
- Lambda 不在 VPC 中
- 安全组规则不正确
- 数据库在私有子网但不在同一 VPC

**解决方案**:

```bash
# 1. 检查 Lambda 是否在 VPC 中
aws lambda get-function-configuration --function-name your-function

# 2. 检查安全组
aws ec2 describe-security-groups --group-ids sg-xxx

# 3. 测试连接
# 在 Lambda 中添加测试代码
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.$queryRaw`SELECT 1`;
```

### Q2: 私有子网 Lambda 无法访问外部 API

**可能原因**:
- 没有配置 NAT Gateway
- 路由表没有指向 NAT Gateway
- NAT Gateway 没有弹性 IP

**解决方案**:

```bash
# 1. 检查 NAT Gateway 状态
aws ec2 describe-nat-gateways --filter "Name=state,Values=available"

# 2. 检查路由表
aws ec2 describe-route-tables --route-table-ids rtb-xxx

# 3. 检查子网关联
aws ec2 describe-subnets --subnet-ids subnet-xxx
```

### Q3: API Gateway 返回 502 错误

**可能原因**:
- Lambda 函数超时
- Lambda 函数抛出异常
- 超出并发限制
- VPC 配置错误（没有 NAT 无法访问公网依赖）

**解决方案**:

```bash
# 1. 查看 CloudWatch Logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/your-function

# 2. 检查 Lambda 日志
aws logs filter-log-events --log-group-name /aws/lambda/your-function

# 3. 检查 Lambda 配置
aws lambda get-function-configuration --function-name your-function
```

### Q4: Lambda 冷启动时间过长

**可能原因**:
- VPC 模式需要创建 ENI（10-60 秒）
- Layer 体积过大
- 代码初始化逻辑复杂

**解决方案**:

```yaml
# 1. 使用 Provisioned Concurrency（付费）
ProvisionedConcurrencyConfig:
  Min: 2
  Target: 80%

# 2. 优化 Layer 大小
# - 只放必要的依赖
# - 使用 esbuild 打包

# 3. 优化初始化代码
# - 延迟初始化（如 PrismaClient）
# - 使用 lazy import
```

### Q5: NAT Gateway 费用过高

**可能原因**:
- 每个 NAT Gateway $0.065/小时
- 3 个 NAT Gateway ≈ $140/月

**解决方案**:

```bash
# 方案 1：只用一个 NAT Gateway（牺牲可用性）
# 将所有私有子网路由指向同一个 NAT Gateway
# 风险：一个可用区故障会影响该可用区的 Lambda

# 方案 2：使用 VPC Endpoint 直连 S3
# 减少 NAT 流量

# 方案 3：使用 NAT Instance 替代（需要自己管理）
# t3.nano ≈ $0.01/小时
```

---

## 相关文档

- [AWS SAM 官方文档](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS VPC 文档](https://docs.aws.amazon.com/vpc/latest/userguide/)
- [AWS IAM 文档](https://docs.aws.amazon.com/iam/)
- [AWS NAT Gateway 文档](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
- [AWS VPC Endpoint 文档](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)

---

## 架构决策树

```
开始部署
    │
    ▼
需要访问 RDS？
    │
    ├─ NO → Lambda 放默认 VPC（无需 VPC 配置）
    │
    └─ YES → 继续
              │
              ▼
         需要访问外部 API？
              │
              ├─ NO → 私有子网 + 无 NAT（最省钱）
              │
              └─ YES → 继续
                        │
                        ▼
                   需要访问 S3？
                        │
                        ├─ NO → 私有子网 + NAT Gateway
                        │
                        └─ YES → 私有子网 + NAT Gateway + S3 Endpoint
```

---

## 成本估算（仅供参考）

| 资源 | 单价 | 数量 | 月费用（估算） |
|------|------|------|----------------|
| NAT Gateway | $0.065/小时 | 3 | ~$140 |
| 弹性 IP | $0.005/小时 | 3 | ~$11 |
| API Gateway | $3.50/百万请求 | - | 取决于流量 |
| Lambda | $0.20/百万请求 | - | 取决于流量 |
| RDS PostgreSQL | ~$50/月（db.t3.micro） | 1 | $50 |
| **总计** | | | **~$200/月起** |

**优化建议**：
- 开发环境：关闭 NAT Gateway，按需启动
- 使用 VPC Endpoint 减少 NAT 流量费
- 使用 S3 直接存储静态文件，减少 API Gateway 流量
