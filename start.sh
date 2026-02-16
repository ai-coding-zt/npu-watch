#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="dev"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
    BACKEND_PORT="${BACKEND_PORT:-3000}"
    FRONTEND_PORT="${FRONTEND_PORT:-5173}"
fi

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
            echo "配置 (.env 文件):"
            echo "  BACKEND_HOST    后端监听地址 (默认: 0.0.0.0)"
            echo "  BACKEND_PORT    后端端口 (默认: 3000)"
            echo "  FRONTEND_PORT   前端端口 (默认: 5173)"
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
echo -e "后端: ${BLUE}$BACKEND_HOST:$BACKEND_PORT${NC}"
echo -e "前端: ${BLUE}0.0.0.0:$FRONTEND_PORT${NC}"
echo ""

if [ ! -d "$SCRIPT_DIR/backend/node_modules" ] || [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${RED}错误: 依赖未安装，请先运行 ./install.sh${NC}"
    exit 1
fi

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

export HOST="$BACKEND_HOST"
export PORT="$BACKEND_PORT"
export VITE_PORT="$FRONTEND_PORT"
export VITE_API_URL="http://localhost:$BACKEND_PORT"

if [ "$MODE" = "prod" ]; then
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
    npx vite preview --port "$FRONTEND_PORT" --host &
    FRONTEND_PID=$!
    
else
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
echo -e "后端 API: ${BLUE}http://$BACKEND_HOST:$BACKEND_PORT${NC}"
echo -e "前端界面: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "按 ${YELLOW}Ctrl+C${NC} 停止服务"
echo ""

wait $BACKEND_PID $FRONTEND_PID
