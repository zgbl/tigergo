#!/bin/bash

# 备份脚本 - 将关键开发文件备份到 releases 文件夹
# 使用方法: ./backup.sh

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取当前日期和时间
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="releases/$DATE"

echo -e "${GREEN}开始备份项目文件...${NC}"
echo -e "${YELLOW}备份目录: $BACKUP_DIR${NC}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 要备份的文件和文件夹列表
BACKUP_ITEMS=(
    "*.html"
    "css/"
    "js/"
    "images/"
    "Sounds/"
    "Tournaments/"
    "README.md"
    "CNAME"
    "favicon.ico"
)

# 要排除的文件和文件夹（Node.js 相关）
EXCLUDE_PATTERNS=(
    "node_modules"
    "package-lock.json"
    "npm-debug.log"
    ".npm"
    ".node_repl_history"
    "*.log"
    ".DS_Store"
    ".git"
    "releases"
)

echo -e "${YELLOW}正在复制文件...${NC}"

# 复制文件和文件夹
for item in "${BACKUP_ITEMS[@]}"; do
    if [[ "$item" == *"/" ]]; then
        # 这是一个文件夹
        folder_name=${item%/}
        if [ -d "$folder_name" ]; then
            echo "复制文件夹: $folder_name"
            cp -r "$folder_name" "$BACKUP_DIR/"
        else
            echo -e "${RED}警告: 文件夹 $folder_name 不存在${NC}"
        fi
    else
        # 这是文件或通配符
        if ls $item 1> /dev/null 2>&1; then
            echo "复制文件: $item"
            cp $item "$BACKUP_DIR/"
        else
            echo -e "${RED}警告: 没有找到匹配 $item 的文件${NC}"
        fi
    fi
done

# 创建备份信息文件
cat > "$BACKUP_DIR/backup_info.txt" << EOF
备份信息
========
备份时间: $(date)
备份脚本版本: 1.0
项目名称: TigerGo
备份内容: 开发中的关键文件（排除 Node.js 依赖）

备份的文件和文件夹:
$(for item in "${BACKUP_ITEMS[@]}"; do echo "- $item"; done)

排除的内容:
$(for pattern in "${EXCLUDE_PATTERNS[@]}"; do echo "- $pattern"; done)
EOF

# 计算备份大小
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo -e "${GREEN}备份完成！${NC}"
echo -e "${YELLOW}备份位置: $BACKUP_DIR${NC}"
echo -e "${YELLOW}备份大小: $BACKUP_SIZE${NC}"
echo -e "${GREEN}备份信息已保存到: $BACKUP_DIR/backup_info.txt${NC}"

# 列出最近的5个备份
echo -e "\n${YELLOW}最近的备份:${NC}"
ls -lt releases/ | head -6