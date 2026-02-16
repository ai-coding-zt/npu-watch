#!/bin/bash

# NPU Watch - 一键启动脚本
# 用于启动前端和后端服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认模式
MODE="dev"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|-p)
            MODE="prod"
            shift
            ;;
        --dev|-d)
            MODE="dev"
            shift
            ;;
        --help|-h)
            echo "NPU Watch - 启动脚本"
            echo ""
            echo "用法: ./start.sh [选项]"
            echo ""
            echo "选项:"
            echo "  -d, --dev     开发模式 (默认)"
            echo "  -p, --prod    生产模式"
            echo "  -h, --help    显示帮助信息"
            echo ""
            echo "端口:"
            echo "  后端: 3000"
            echo "  前端: 5173 (开发) / 3000 (生产，通过后端代理)"
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            echo "运行 ./start.sh --help 查看帮助"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   NPU Watch - 启动脚本${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "模式: ${YELLOW}$MODE${NC}"
echo ""

# 检查是否已安装依赖
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ] || [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${RED}错误: 依赖未安装，请先运行 ./install.sh${NC}"
    exit 1
fi

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

if [ "$MODE" = "prod" ]; then
    # 生产模式
    echo -e "${YELLOW}检查构建产物...${NC}"
    
    if [ ! -d "$SCRIPT_DIR/backend/dist" ] || [ ! -d "$SCRIPT_DIR/frontend/dist" ]; then
        echo -e "${RED}错误: 构建产物不存在，请先运行 ./install.sh${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}启动后端服务 (生产模式)...${NC}"
    cd "$SCRIPT_DIR/backend"
    node dist/index.js &
    BACKEND_PID=$!
    
    echo -e "${GREEN}启动前端服务 (生产模式)...${NC}"
    cd "$SCRIPT_DIR/frontend"
    npx vite preview --port 5173 &
    FRONTEND_PID=$!
    
else
    # 开发模式
    echo -e "${GREEN}启动后端服务 (开发模式)...${NC}"
    cd "$SCRIPT_DIR/backend"
    npm run dev &
    BACKEND_PID=$!
    
    echo -e "${GREEN}启动前端服务 (开发模式)...${NC}"
    cd "$SCRIPT_DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   服务已启动!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "后端 API: ${BLUE}http://localhost:3000${NC}"
echo -e "前端界面: ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "按 ${YELLOW}Ctrl+C${NC} 停止服务"
echo ""

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
