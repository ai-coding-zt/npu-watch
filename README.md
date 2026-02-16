# NPU Watch

> 华为昇腾 NPU 设备监控系统 - 基于 Web 的实时监控、SSH 终端、文件管理

![Vue](https://img.shields.io/badge/Vue-3.4-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express)
![License](https://img.shields.io/badge/License-MIT-green)

## 功能特性

- **服务器管理** - 添加、编辑、删除多个 NPU 服务器
- **SSH 认证** - 支持密码和 SSH 密钥两种认证方式
- **实时监控** - 温度、功耗、内存、AI Core 使用率、ECC 错误
- **进程监控** - 查看设备上运行的进程
- **SSH 终端** - 内置 Web 终端，直接操作远程服务器
- **文件管理** - SFTP 文件浏览、上传、下载
- **历史数据** - 24 小时历史数据查询与图表
- **自动刷新** - 可配置的自动刷新间隔 (10s-300s)
- **主题切换** - Discord 风格的深色/浅色主题

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 一键安装

```bash
chmod +x install.sh
./install.sh
```

安装脚本会自动：
1. 检查 Node.js 环境
2. 安装后端依赖
3. 安装前端依赖
4. 构建生产版本

### 一键启动

```bash
# 开发模式（默认）
chmod +x start.sh
./start.sh

# 生产模式
./start.sh --prod

# 查看帮助
./start.sh --help
```

| 模式 | 后端 | 前端 |
|------|------|------|
| 开发 | `npm run dev` (热重载) | `npm run dev` (热重载) |
| 生产 | `node dist/index.js` | `vite preview` |

启动后访问：
- 前端界面: http://localhost:5173
- 后端 API: http://localhost:3000

## 配置

项目支持通过 `.env` 文件配置端口和地址。

### 配置文件

首次运行 `./install.sh` 会自动从 `.env.example` 复制创建 `.env` 文件：

```bash
# NPU Watch 配置

# 后端配置
BACKEND_HOST=0.0.0.0    # 监听地址 (0.0.0.0 = 所有网卡)
BACKEND_PORT=3000       # 后端端口

# 前端配置
FRONTEND_PORT=5173      # 前端端口
```

### 修改配置

1. 编辑项目根目录的 `.env` 文件
2. 修改需要更改的配置项
3. 重启服务 `./start.sh`

### 环境变量优先级

```bash
# 也可以通过命令行覆盖配置
BACKEND_PORT=8080 FRONTEND_PORT=80 ./start.sh
```

## 从旧版本升级

如果你使用的是没有 `.env` 配置的旧版本：

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 创建配置文件
cp .env.example .env

# 3. (可选) 编辑配置
vim .env

# 4. 更新依赖并构建
./install.sh

# 5. 启动服务
./start.sh
```

旧版本的数据库文件 (`npu-watch.db`) 会自动保留，无需迁移。

## 项目结构

```
npu-watch/
├── install.sh          # 一键安装脚本
├── start.sh            # 一键启动脚本
├── README.md
├── .gitignore
├── backend/            # Express + TypeScript API
│   ├── src/
│   │   ├── index.ts       # 入口文件
│   │   ├── types.ts       # 类型定义
│   │   ├── constants/     # 常量配置
│   │   ├── utils/         # 工具函数
│   │   ├── routes/        # API 路由
│   │   └── services/      # 业务逻辑
│   ├── package.json
│   └── tsconfig.json
├── frontend/           # Vue 3 + TypeScript SPA
│   ├── src/
│   │   ├── main.ts        # 入口文件
│   │   ├── App.vue        # 根组件
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── api/           # API 客户端
│   │   ├── router/        # 路由配置
│   │   ├── styles/        # 样式文件
│   │   └── types/         # 类型定义
│   ├── package.json
│   └── vite.config.ts
└── skills/             # AI 技能文档 (非代码)
    └── npu-smi/        # npu-smi 命令参考
```

## API 接口

### 服务器管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/servers` | 获取服务器列表 |
| POST | `/api/servers` | 创建服务器 |
| GET | `/api/servers/:id` | 获取服务器详情 |
| PUT | `/api/servers/:id` | 更新服务器 |
| DELETE | `/api/servers/:id` | 删除服务器 |
| POST | `/api/servers/:id/connect` | 连接服务器 |
| POST | `/api/servers/:id/disconnect` | 断开连接 |
| GET | `/api/servers/:id/status` | 获取连接状态 |

### 监控接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/servers/:id/monitor` | 获取 NPU 监控数据 |
| GET | `/api/servers/:id/devices` | 获取设备列表 |
| GET | `/api/servers/:id/chips` | 获取芯片列表 |
| GET | `/api/servers/:id/health` | 获取健康状态 |
| GET | `/api/servers/:id/system` | 获取系统指标 |
| GET | `/api/servers/:id/npu-history` | NPU 历史数据 |
| GET | `/api/servers/:id/system-history` | 系统历史数据 |

### 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/:serverId/list` | 列出文件 |
| POST | `/api/files/:serverId/mkdir` | 创建目录 |
| POST | `/api/files/:serverId/rename` | 重命名 |
| DELETE | `/api/files/:serverId` | 删除文件/目录 |
| GET | `/api/files/:serverId/download` | 下载文件 |
| POST | `/api/files/:serverId/upload` | 上传文件 |

### WebSocket

| 路径 | 说明 |
|------|------|
| `/api/terminal/:serverId` | SSH 终端会话 |

## 监控指标

| 指标 | 说明 | 单位 |
|------|------|------|
| Temperature | NPU / AI Core 温度 | °C |
| Power | 功耗 | W |
| Memory Usage | 内存使用率 | % |
| AI Core Usage | AI Core 利用率 | % |
| Bandwidth | 带宽使用率 | % |
| ECC Errors | ECC 错误计数 | - |

## 技术栈

**前端**
- Vue 3 + Composition API
- TypeScript
- Vite
- Pinia (状态管理)
- Vue Router
- Axios
- xterm.js (终端)

**后端**
- Express
- TypeScript
- node-ssh (SSH 连接)
- better-sqlite3 (数据库)
- ws (WebSocket)
- Zod (参数校验)

## 开发命令

```bash
# 后端
cd backend
npm run dev      # 开发模式
npm run build    # 构建
npm start        # 生产模式

# 前端
cd frontend
npm run dev      # 开发模式
npm run build    # 构建
npm run preview  # 预览构建结果
```

## 前置条件

目标 NPU 服务器需要：
- 安装 `npu-smi` 工具
- 开启 SSH 服务 (端口 22 或自定义)
- 网络可达

## 许可证

MIT
