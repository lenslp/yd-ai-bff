# yd-ai-bff 部署指南（EC2 + PM2）

> 本文档包含完整的 EC2 创建流程和项目部署步骤。

## 目录

- [一、EC2 创建指南（新手版）](#一ec2-创建指南新手版)
- [二、连接 EC2](#二连接-ec2)
- [三、环境准备](#三环境准备)
- [四、数据库配置](#四数据库配置)
- [五、项目部署](#五项目部署)
- [六、PM2 启动](#六pm2-启动)
- [七、Nginx 配置（可选）](#七nginx-配置可选)
- [八、零停机部署](#八零停机部署)
- [九、常见问题](#九常见问题)

---

# 一、EC2 创建指南（新手版）

## 1.1 什么是 EC2？

**EC2（Elastic Compute Cloud）** 是 AWS 提供的云服务器服务，相当于一台虚拟服务器：

- 可以 SSH 登录
- 安装 Node / Java / Python 等运行环境
- 部署 Web 应用
- **注意：Running 状态会持续计费**

## 1.2 创建 EC2 实例

### 步骤 1：进入 EC2 控制台

- 登录 AWS Console
- 搜索 **EC2** 并进入
- 点击 **Launch instance**

### 步骤 2：选择操作系统（AMI）

选择 **Amazon Linux 2023**（官方推荐，兼容性好）

### 步骤 3：选择实例规格

| 规格 | 费用 | 适用场景 |
|------|------|----------|
| t3.micro | 免费额度内 | 学习测试 |
| t3.small | ~$15/月 | 稳定运行 |
| t4g.micro | 更便宜 | 低成本学习 |

### 步骤 4：创建密钥对（Key Pair）

- 点击 **Create new key pair**
- 类型：RSA
- 格式：.pem（macOS/Linux）
- 下载并保存到 `~/.ssh/` 目录

### 步骤 5：配置网络（默认即可）

- VPC：Default VPC
- Subnet：任意可用区
- **Auto-assign public IP：Enable（必须）**

### 步骤 6：配置安全组（防火墙）

**最小可用配置：**

| 类型 | 端口 | 来源 | 用途 |
|------|------|------|------|
| SSH | 22 | 你的 IP | 远程登录 |
| HTTP | 80 | 0.0.0.0/0 | 网页访问 |
| HTTPS | 443 | 0.0.0.0/0 | 安全访问 |

⚠️ **重要：SSH 端口只开放给你的 IP，防止被黑客入侵**

### 步骤 7：启动实例

点击 **Launch instance**，等待状态变为 `running`

## 1.3 新手避坑指南

| 坑点 | 后果 | 解决方法 |
|------|------|----------|
| 实例 Running 不关 | 持续扣费 | 用完 Stop |
| SSH 端口全开放 | 安全风险 | 限制来源 IP |
| 规格选太大 | 费用过高 | 学习用 t3.micro |
| Key 丢了 | 无法登录 | 保存好 .pem 文件 |
| Stop 和 Terminate 分不清 | 误删数据 | Stop 只是停止 |

## 1.4 实例生命周期

```
Running（运行中）────计费中────► Stop（停止）───不计计算费────► Start（启动）
                                        │
                                        ▼
                                 Terminate（终止）───释放资源───不可恢复
```

- **Stop**：停止计算，磁盘仍收费，可重新启动
- **Terminate**：删除实例，磁盘（若设为随实例删除）不再收费，不可恢复

---

# 二、连接 EC2

## 2.1 设置密钥权限

```bash
chmod 400 ~/.ssh/your-key.pem
```

## 2.2 SSH 连接

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<公网IP>
```

> 默认用户：**ec2-user**（Amazon Linux）

---

## 三、环境准备

### 3.1 安装 Node.js 20+

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装并使用 Node.js 20
nvm install 20 && nvm use 20

# 验证
node -v
npm -v
```

### 3.2 安装 Yarn 和 PM2

```bash
npm install -g yarn pm2

# 验证
yarn -v
pm2 -v
```

---

## 四、数据库配置

### 4.1 安装 PostgreSQL

```bash
sudo dnf update -y
sudo dnf install postgresql postgresql-server -y
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4.2 创建数据库和用户

```bash
sudo -i -u postgres
psql
```

```sql
CREATE DATABASE yd_ai_bff;
CREATE USER myuser WITH ENCRYPTED PASSWORD '126261Lp';
GRANT ALL PRIVILEGES ON DATABASE yd_ai_bff TO myuser;
ALTER DATABASE yd_ai_bff OWNER TO myuser;
\q
```

### 4.3 配置密码登录

```bash
sudo vim /var/lib/pgsql/data/pg_hba.conf
```

修改以下内容：

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

```bash
sudo systemctl restart postgresql
```

---

## 五、项目部署

### 5.1 上传代码到 EC2

**方式 A：Git clone（推荐）**

```bash
cd /home/ec2-user
git clone https://github.com/lenslp/yd-ai-bff.git
cd yd-ai-bff
```

**方式 B：本地上传**

```bash
scp -i ~/.ssh/your-key.pem -r /path/to/yd-ai-bff ec2-user@your-ec2-ip:/home/ec2-user/
```

### 5.2 配置环境变量

```bash
vim .env
```

```env
DATABASE_URL="postgresql://myuser:126261Lp@localhost:5432/yd_ai_bff"
NODE_ENV=production
PORT=8082
```

### 5.3 安装依赖并构建

```bash
yarn install
yarn prisma:generate
yarn build
```

---

## 六、PM2 启动

### 6.1 启动应用

```bash
yarn pm2:start
```

### 6.2 管理命令

| 命令 | 说明 |
|------|------|
| `pm2 list` | 查看状态 |
| `pm2 logs yd-ai-bff` | 查看日志 |
| `pm2 restart yd-ai-bff` | 重启 |
| `pm2 stop yd-ai-bff` | 停止 |
| `pm2 delete yd-ai-bff` | 删除 |

### 6.3 设置开机自启

```bash
sudo env PATH=$PATH:/home/ec2-user/.nvm/versions/node/v20.x.x/bin \
  /home/ec2-user/.nvm/versions/node/v20.x.x/lib/node_modules/pm2/bin/pm2 \
  startup systemd -u ec2-user --hp /home/ec2-user
pm2 save
```

### 6.4 验证部署

```bash
curl http://localhost:8082/api/list
curl http://localhost:8082/api/users
```

---

## 七、Nginx 配置（可选）

### 7.1 安装 Nginx

```bash
sudo dnf install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 7.2 配置反向代理

```bash
sudo vim /etc/nginx/conf.d/yd-ai-bff.conf
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或 EC2 公网 IP

    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7.3 重启 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 八、零停机部署

### 8.1 部署流程

```bash
# 1. 本地修改代码并提交
git add .
git commit -m "feat: 更新内容"
git push

# 2. 在 EC2 上执行部署
cd /home/ec2-user/yd-ai-bff
git pull
yarn install
yarn build
pm2 reload yd-ai-bff --env production
pm2 save

# 3. 验证
curl http://localhost:8082/api/list
```

### 8.2 使用部署脚本

项目已包含 `deploy.sh`，直接执行：

```bash
bash deploy.sh
```

---

## 九、常见问题

### Q1：连接数据库失败

```bash
# 测试连接
psql -U myuser -d yd_ai_bff -h localhost

# 检查 pg_hba.conf
sudo vim /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql
```

### Q2：端口不通

```bash
# 检查安全组（AWS 控制台）
# EC2 → 安全组 → 编辑入站规则 → 开放 8082 端口

# 检查防火墙
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=8082/tcp
sudo firewall-cmd --reload
```

### Q3：查看 PM2 日志

```bash
pm2 logs yd-ai-bff --lines 100 --nostream
```

### Q4：重置数据库

```bash
sudo -i -u postgres
psql -c "DROP DATABASE yd_ai_bff;"
psql -c "CREATE DATABASE yd_ai_bff;"
psql -d yd_ai_bff -c "GRANT ALL ON DATABASE yd_ai_bff TO myuser;"
```

---

## 附录：安全组配置参考

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 你的 IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 8082 | TCP | 0.0.0.0/0 | 应用端口 |

---

## 附录：命令速查

| 操作 | 命令 |
|------|------|
| SSH 连接 | `ssh -i ~/.ssh/your-key.pem ec2-user@ip` |
| 查看 PM2 状态 | `pm2 list` |
| 查看日志 | `pm2 logs yd-ai-bff` |
| 重启服务 | `pm2 restart yd-ai-bff` |
| 测试 API | `curl http://localhost:8082/api/list` |
| 数据库连接 | `psql -U myuser -d yd_ai_bff -h localhost` |
