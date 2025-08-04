#!/bin/bash

# 恢复脚本 - 从备份中恢复文件
# 使用方法: ./backup_restore.sh [备份日期文件夹名]

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否提供了备份文件夹参数
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}可用的备份:${NC}"
    ls -1 releases/ 2>/dev/null || echo -e "${RED}没有找到备份文件夹${NC}"
    echo ""
    echo -e "${YELLOW}使用方法: ./backup_restore.sh [备份文件夹名]${NC}"
    echo -e "${YELLOW}例如: ./backup_restore.sh 20240103_143022${NC}"
    exit 1
fi

BACKUP_FOLDER="$1"
BACKUP_PATH="releases/$BACKUP_FOLDER"

# 检查备份文件夹是否存在
if [ ! -d "$BACKUP_PATH" ]; then
    echo -e "${RED}错误: 备份文件夹 $BACKUP_PATH 不存在${NC}"
    exit 1
fi

echo -e "${YELLOW}准备从以下备份恢复:${NC}"
echo -e "${GREEN}$BACKUP_PATH${NC}"

# 显示备份信息
if [ -f "$BACKUP_PATH/backup_info.txt" ]; then
    echo -e "\n${YELLOW}备份信息:${NC}"
    cat "$BACKUP_PATH/backup_info.txt"
fi

echo -e "\n${RED}警告: 这将覆盖当前的文件！${NC}"
read -p "确定要继续吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}恢复操作已取消${NC}"
    exit 1
fi

echo -e "${GREEN}开始恢复文件...${NC}"

# 复制文件回项目根目录
cp -r "$BACKUP_PATH"/* .

# 删除备份信息文件（不需要在项目根目录）
rm -f backup_info.txt

echo -e "${GREEN}恢复完成！${NC}"
echo -e "${YELLOW}已从 $BACKUP_PATH 恢复文件${NC}"