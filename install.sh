#!/bin/bash

# NPU Watch - 一键安装脚本
# 用于安装所有依赖项

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   NPU Watch - 安装脚本${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
    echo -e "${GREEN}✓ 配置文件 .env 已存在${NC}"
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ 已创建配置文件 .env (从 .env.example 复制)${NC}"
    fi
fi
echo ""

# 检查 Node.js
echo -e "${YELLOW}[1/4] 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装 Node.js 18+${NC}"
    echo -e "${YELLOW}推荐使用 nvm 安装: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}错误: Node.js 版本过低 (当前: $(node -v))，需要 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"
echo ""

# 安装后端依赖
echo -e "${YELLOW}[2/4] 安装后端依赖...${NC}"
cd "$SCRIPT_DIR/backend"
npm install
echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
echo ""

# 安装前端依赖
echo -e "${YELLOW}[3/4] 安装前端依赖...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
echo ""

# 构建生产版本
echo -e "${YELLOW}[4/4] 构建生产版本...${NC}"
cd "$SCRIPT_DIR/backend"
npm run build
echo -e "${GREEN}✓ 后端构建完成${NC}"

cd "$SCRIPT_DIR/frontend"
npm run build
echo -e "${GREEN}✓ 前端构建完成${NC}"
echo ""

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   安装完成!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "运行 ${BLUE}./start.sh${NC} 启动服务"
echo ""
