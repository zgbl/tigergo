#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
KataGo Analysis HTTP Server SGF 测试工具
适配新的Analysis服务API格式
主要改进：
1. 适配analysis服务的返回格式
2. 解析analysis数组中的详细信息
3. 优化数据展示格式
4. 增强调试功能
"""

import requests
import json
import time
import re
import sys
from datetime import datetime
from typing import List, Dict, Optional, Tuple

class SGFAnalysisTester:
    """SGF Analysis HTTP 测试工具"""
    
    #def __init__(self, base_url: str = "http://localhost:8080"):
    def __init__(self, base_url: str = "http://192.168.0.249:8080"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SGF-Analysis-Tester/1.0'
        })
        self.analysis_interval = 3  # 3秒间隔，减少等待时间
        self.debug_mode = False  # 默认关闭调试模式，减少输出
    
    def print_status(self, message: str, status: str = "INFO"):
        """打印带状态的消息"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        status_symbols = {
            'INFO': '🔵',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'ANALYSIS': '🧠',
            'MOVE': '🎯',
            'DEBUG': '🐛'
        }
        symbol = status_symbols.get(status, '🔵')
        print(f"[{timestamp}] {symbol} {message}")
    
    def debug_print(self, message: str, data=None):
        """调试打印"""
        if self.debug_mode:
            self.print_status(f"DEBUG: {message}", "DEBUG")
            if data is not None:
                # 只显示关键字段，不显示完整的response
                if isinstance(data, dict) and 'full_analysis' in data:
                    # 简化显示，去掉大量数据
                    simplified = {
                        'bot_move': data.get('bot_move'),
                        'winrate': data.get('winrate'),
                        'score': data.get('score'),
                        'visits': data.get('visits'),
                        'analysis_count': len(data.get('analysis', []))
                    }
                    print(json.dumps(simplified, indent=2, ensure_ascii=False))
                else:
                    print(json.dumps(data, indent=2, ensure_ascii=False))
    
    def parse_sgf_moves(self, sgf_content: str) -> List[List[str]]:
        """解析SGF内容中的着法"""
        moves = []
        
        # 清理SGF内容
        sgf_content = re.sub(r'\s+', ' ', sgf_content.strip())
        
        # SGF解析正则表达式 - 匹配 ;B[xx] 或 ;W[xx] 格式
        move_pattern = r';([BW])\[([a-t]*)\]'
        matches = re.findall(move_pattern, sgf_content, re.IGNORECASE)
        
        self.print_status(f"找到 {len(matches)} 个着法匹配项")
        
        for i, (color, pos) in enumerate(matches):
            color = color.upper()
            pos = pos.lower().strip()
            
            if pos and len(pos) == 2:  # 正常着法
                try:
                    col_sgf = pos[0]  # a-s
                    row_sgf = pos[1]  # a-s
                    
                    # 检查坐标范围
                    if col_sgf < 'a' or col_sgf > 's' or row_sgf < 'a' or row_sgf > 's':
                        self.print_status(f"跳过无效坐标: {pos}", "WARNING")
                        continue
                    
                    # 转换列坐标 (a-s -> A-T, 跳过I)
                    col_index = ord(col_sgf) - ord('a')  # 0-18
                    if col_index >= 8:  # i及之后的字母
                        col_katago = chr(ord('A') + col_index + 1)  # 跳过I
                    else:
                        col_katago = chr(ord('A') + col_index)
                    
                    # 转换行坐标 (SGF的a=19行, s=1行)
                    row_index = ord(row_sgf) - ord('a')  # 0-18
                    row_katago = str(19 - row_index)
                    
                    katago_pos = col_katago + row_katago
                    moves.append([color, katago_pos])
                    
                    # 调试信息
                    self.debug_print(f"转换: {color}[{pos}] -> [{color}, {katago_pos}]")
                    
                except Exception as e:
                    self.print_status(f"转换失败 {pos}: {e}", "ERROR")
                    continue
                    
            elif not pos:  # 空着法 (pass)
                moves.append([color, "pass"])
                self.debug_print(f"Pass: {color}[] -> [{color}, pass]")
            else:
                self.print_status(f"跳过格式错误的着法: {pos}", "WARNING")
        
        return moves
    
    def test_basic_api_call(self):
        """测试基本API调用"""
        self.print_status("测试基本API调用...", "DEBUG")
        
        test_cases = [
            {
                "name": "空局面",
                "payload": {
                    "board_size": 19,
                    "moves": []
                }
            },
            {
                "name": "单手棋",
                "payload": {
                    "board_size": 19,
                    "moves": [["B", "Q16"]]
                }
            },
            {
                "name": "两手棋",
                "payload": {
                    "board_size": 19,
                    "moves": [["B", "Q16"], ["W", "D16"]]
                }
            },
            {
                "name": "三手棋",
                "payload": {
                    "board_size": 19,
                    "moves": [["B", "Q16"], ["W", "D16"], ["B", "Q3"]]
                }
            }
        ]
        
        for test_case in test_cases:
            self.print_status(f"测试: {test_case['name']}")
            try:
                response = self.session.post(
                    f"{self.base_url}/select-move/katago_gtp_bot",
                    json=test_case["payload"],
                    timeout=30
                )
                
                self.debug_print(f"请求: {test_case['name']}", test_case["payload"])
                self.debug_print(f"响应状态: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.debug_print(f"响应数据: {test_case['name']}", data)
                    
                    # 解析新格式的返回数据
                    self.print_analysis_summary(data, test_case['name'])
                else:
                    self.print_status(f"HTTP错误: {response.status_code}", "ERROR")
                    self.print_status(f"错误内容: {response.text}", "ERROR")
                    
            except Exception as e:
                self.print_status(f"API调用异常: {str(e)}", "ERROR")
            
            print("-" * 50)
    
    def print_analysis_summary(self, data: Dict, context: str = ""):
        """打印分析数据摘要"""
        # 提取关键信息
        bot_move = data.get('bot_move', 'N/A')
        winrate = data.get('winrate', 'N/A')
        score = data.get('score', 'N/A')
        visits = data.get('visits', 'N/A')
        analysis = data.get('analysis', [])
        
        # 格式化显示
        if isinstance(winrate, (int, float)):
            winrate_str = f"{winrate * 100:.1f}%"
        else:
            winrate_str = str(winrate)
        
        if isinstance(score, (int, float)):
            score_str = f"{score:.2f}"
        else:
            score_str = str(score)
        
        self.print_status(f"推荐: {bot_move} | 胜率: {winrate_str} | 分数: {score_str} | 访问: {visits}")
        
        # 显示候选手信息
        if analysis and len(analysis) > 0:
            self.print_status(f"候选手数量: {len(analysis)}")
            for i, move_info in enumerate(analysis[:5]):  # 只显示前5个
                move = move_info.get('move', 'N/A')
                move_winrate = move_info.get('winrate', 0)
                move_visits = move_info.get('visits', 0)
                move_score = move_info.get('scoreLead', move_info.get('scoreMean', 0))
                
                self.print_status(
                    f"  第{i+1}: {move} "
                    f"(胜率:{move_winrate*100:.1f}%, "
                    f"分数:{move_score:.2f}, "
                    f"访问:{move_visits})"
                )
    
    def health_check(self) -> Dict:
        """检查服务器健康状态"""
        response = self.session.get(f"{self.base_url}/health", timeout=10)
        response.raise_for_status()
        return response.json()
    
    def test_server_connection(self) -> bool:
        """测试服务器连接"""
        self.print_status("测试服务器连接...")
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.print_status(f"服务器连接成功: {data.get('status')}", "SUCCESS")
                return True
            else:
                self.print_status(f"服务器连接失败: HTTP {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.print_status(f"服务器连接异常: {str(e)}", "ERROR")
            return False
    
    def get_server_info(self) -> Optional[Dict]:
        """获取服务器信息"""
        try:
            response = self.session.get(f"{self.base_url}/info", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.print_status(f"服务器: {data.get('name')} v{data.get('version')}", "INFO")
                self.print_status(f"模型: {data.get('model_file')}", "INFO")
                return data
            else:
                self.print_status(f"获取服务器信息失败: HTTP {response.status_code}", "ERROR")
                return None
        except Exception as e:
            self.print_status(f"获取服务器信息异常: {str(e)}", "ERROR")
            return None
    
    def select_move(self, moves, board_size=19):
        """调用KataGo Analysis API获取分析结果"""
        payload = {
            "board_size": board_size,
            "moves": moves
        }
        
        # 调试信息
        self.debug_print("API请求payload", payload)
        
        response = self.session.post(
            f"{self.base_url}/select-move/katago_gtp_bot",
            json=payload,
            timeout=30
        )
        
        self.debug_print(f"API响应状态: {response.status_code}")
        
        if response.status_code != 200:
            self.print_status(f"API错误: {response.status_code}", "ERROR")
            self.print_status(f"错误内容: {response.text}", "ERROR")
        
        response.raise_for_status()
        result = response.json()
        
        # 调试信息
        self.debug_print("API响应数据", result)
        
        return result
    
    def analyze_position(self, moves: List[List[str]], move_number: int) -> Optional[Dict]:
        """分析指定手数的局面"""
        try:
            # 只取到指定手数的着法
            api_moves = moves[:move_number]
            
            self.debug_print(f"分析第{move_number}手，使用着法", api_moves)
            
            start_time = time.time()
            data = self.select_move(api_moves, board_size=19)
            elapsed_time = time.time() - start_time
            
            data['analysis_time'] = elapsed_time
            
            return data
                
        except Exception as e:
            self.print_status(f"分析异常: {str(e)}", "ERROR")
            return None
    
    def format_analysis_result(self, result: Dict, move_number: int, current_move: List[str]) -> str:
        """格式化分析结果"""
        if not result:
            return "分析失败"
        
        analysis_time = result.get('analysis_time', 0)
        
        # 提取关键信息
        bot_move = result.get('bot_move', 'N/A')
        winrate = result.get('winrate')
        score = result.get('score')
        visits = result.get('visits', 'N/A')
        analysis = result.get('analysis', [])
        
        # 如果主要字段为空，尝试从analysis数组中获取
        if analysis and len(analysis) > 0:
            first_move = analysis[0]
            if not bot_move or bot_move == 'N/A':
                bot_move = first_move.get('move', 'N/A')
            if winrate is None:
                winrate = first_move.get('winrate')
            if score is None:
                score = first_move.get('scoreLead', first_move.get('scoreMean'))
            if visits == 'N/A':
                visits = first_move.get('visits', 'N/A')
        
        # 格式化胜率
        if isinstance(winrate, (int, float)):
            winrate_str = f"{winrate * 100:.1f}%"
        else:
            winrate_str = "N/A"
        
        # 格式化分数
        if isinstance(score, (int, float)):
            score_str = f"{score:.2f}"
        else:
            score_str = "N/A"
        
        # 构建输出
        output = []
        output.append(f"第{move_number}手: {current_move[0]} {current_move[1]}")
        output.append(f"推荐: {bot_move}")
        output.append(f"胜率: {winrate_str}")
        output.append(f"分数: {score_str}")
        output.append(f"访问: {visits}")
        output.append(f"用时: {analysis_time:.2f}s")
        
        return " | ".join(output)
    
    def format_detailed_analysis(self, result: Dict, move_number: int, current_move: List[str]):
        """格式化详细分析结果 - 简化版本"""
        if not result:
            self.print_status("分析失败", "ERROR")
            return
        
        # 打印基本信息
        basic_info = self.format_analysis_result(result, move_number, current_move)
        self.print_status(basic_info, "SUCCESS")
        
        # 只打印前5个候选手的简要信息
        analysis = result.get('analysis', [])
        if analysis and len(analysis) > 0:
            candidates = []
            for i, move_info in enumerate(analysis[:5]):
                move = move_info.get('move', 'N/A')
                winrate = move_info.get('winrate', 0)
                score_lead = move_info.get('scoreLead', 0)
                visits = move_info.get('visits', 0)
                
                candidates.append(f"{move}({winrate*100:.1f}%)")
            
            candidates_str = " ".join(candidates)
            self.print_status(f"候选手: {candidates_str}", "INFO")
    
    def step_by_step_analysis(self, moves: List[List[str]], start_from: int = 1, 
                            end_at: Optional[int] = None, detailed: bool = False):
        """逐步分析棋局"""
        if end_at is None:
            end_at = len(moves)
        
        self.print_status(f"开始逐步分析: 第{start_from}手到第{end_at}手", "ANALYSIS")
        self.print_status(f"分析间隔: {self.analysis_interval}秒")
        self.print_status(f"详细模式: {'开启' if detailed else '关闭'}")
        
        for i in range(start_from, end_at + 1):
            current_move = moves[i - 1]
            
            self.print_status(f"分析第{i}手: {current_move[0]} {current_move[1]}", "MOVE")
            
            # 分析当前局面
            result = self.analyze_position(moves, i)
            
            if result:
                if detailed:
                    self.format_detailed_analysis(result, i, current_move)
                else:
                    analysis_text = self.format_analysis_result(result, i, current_move)
                    self.print_status(analysis_text, "SUCCESS")
            else:
                self.print_status(f"第{i}手分析失败", "ERROR")
            
            # 如果不是最后一手，等待指定时间
            if i < end_at:
                self.print_status(f"等待{self.analysis_interval}秒后继续...")
                time.sleep(self.analysis_interval)
        
        self.print_status("分析完成!", "SUCCESS")
    
    def handle_sgf_input(self):
        """处理SGF输入"""
        print("\n请输入SGF内容 (输入空行结束):")
        sgf_lines = []
        while True:
            line = input()
            if not line.strip():
                break
            sgf_lines.append(line)
        
        sgf_content = '\n'.join(sgf_lines)
        
        if not sgf_content.strip():
            self.print_status("SGF内容不能为空", "ERROR")
            return
        
        self.process_sgf(sgf_content)
    
    def handle_example_sgf(self):
        """处理示例SGF"""
        example_sgf = """(;FF[4]
CA[UTF-8]
GM[1]
DT[2024-06-25]
PC[OGS: `https://online-go.com/game/65465972]`
GN[Friendly Match]
PB[minshan]
PW[AlexanderQi]
BR[?]
WR[?]
TM[3600]OT[25/600 canadian]
RE[W+R]
SZ[19]
KM[7.5]
RU[AGA]
;B[qd]
;W[cp]
;B[pq]
;W[dc]
;B[eq]
;W[oc]
;B[dn]
;W[pe]
;B[qe]
;W[pf]
;B[rg]
;W[ep]
;B[dp]
;W[do]
;B[dq]
;W[co]
;B[eo]
;W[fp]
;B[cq]
;W[cn]
;B[fo]
;W[fq]
;B[fr]
;W[gr]
;B[er]
;W[dm]
;B[go]
;W[pp]
;B[op]
;W[qq]
;B[po]
;W[qp]
;B[oq]
;W[rn]
;B[qm]
;W[qn]
;B[pm]
;W[pn]
;B[on]
;W[om]
;B[rm]
;W[ol]
;B[pk]
;W[ok]
;B[pj]
;W[oj]
;B[pi]
;W[qr]
;B[nn]
;W[oi]
;B[oh]
;W[pl]
;B[qk]
;W[nh]
;B[og]
;W[qg]
;B[ng]
;W[rh]
;B[rf]
;W[qh]
;B[ph]
;W[ne]
;B[mh]
;W[lk]
;B[pb]
;W[kq]
;B[ko]
;W[hp]
;B[gp]
;W[gq]
;B[hq])"""
        
        self.print_status("使用示例SGF进行分析", "INFO")
        self.process_sgf(example_sgf)
    
    def handle_set_interval(self):
        """设置分析间隔"""
        try:
            interval = float(input(f"请输入分析间隔(秒，当前: {self.analysis_interval}): "))
            if interval > 0:
                self.analysis_interval = interval
                self.print_status(f"分析间隔已设置为 {interval} 秒", "SUCCESS")
            else:
                self.print_status("间隔必须大于0", "ERROR")
        except ValueError:
            self.print_status("无效的数值", "ERROR")
    
    def process_sgf(self, sgf_content: str):
        """处理SGF内容"""
        # 解析SGF
        moves = self.parse_sgf_moves(sgf_content)
        
        if not moves:
            self.print_status("未解析到有效着法，请检查SGF格式", "ERROR")
            return
        
        self.print_status(f"解析到 {len(moves)} 手棋", "SUCCESS")
        
        # 显示前几手
        preview_count = min(5, len(moves))
        for i in range(preview_count):
            color, pos = moves[i]
            self.print_status(f"第{i+1}手: {color} {pos}", "INFO")
        
        if len(moves) > preview_count:
            self.print_status(f"... 还有 {len(moves) - preview_count} 手", "INFO")
        
        # 设置分析范围
        try:
            range_input = input(f"\n分析范围 (1-{len(moves)}, 格式: 开始-结束 或 结束手数, 直接回车分析全部): ").strip()
            
            start_from = 1
            end_at = len(moves)
            
            if range_input:
                if '-' in range_input:
                    start_str, end_str = range_input.split('-', 1)
                    start_from = int(start_str.strip())
                    end_at = int(end_str.strip())
                else:
                    end_at = int(range_input)
                
                # 验证范围
                if start_from < 1 or end_at > len(moves) or start_from > end_at:
                    self.print_status("无效范围，使用默认范围", "WARNING")
                    start_from = 1
                    end_at = len(moves)
            
            # 选择分析模式
            detailed_input = input("是否启用详细分析模式？(显示候选手和变化) (y/N): ").strip().lower()
            detailed = detailed_input == 'y'
            
            # 确认开始分析
            mode_str = "详细" if detailed else "简要"
            confirm = input(f"\n确定{mode_str}分析第{start_from}手到第{end_at}手吗？(y/N): ").strip().lower()
            if confirm == 'y':
                # 测试连接
                if not self.test_server_connection():
                    self.print_status("服务器连接失败，无法进行分析", "ERROR")
                    return
                
                # 开始分析
                self.step_by_step_analysis(moves, start_from, end_at, detailed)
            else:
                self.print_status("取消分析", "INFO")
                
        except ValueError:
            self.print_status("无效的范围格式", "ERROR")
        except KeyboardInterrupt:
            self.print_status("\n用户中断分析", "WARNING")
    
    def interactive_mode(self):
        """交互模式"""
        self.print_status("进入交互模式")
        
        while True:
            print("\n" + "="*60)
            print("KataGo Analysis HTTP 测试工具 - 交互模式")
            print("1. 输入SGF内容进行分析")
            print("2. 使用示例SGF")
            print("3. 设置分析间隔")
            print("4. 测试服务器连接")
            print("5. 测试API调用 (调试用)")
            print("6. 切换调试模式")
            print("7. 退出")
            print("="*60)
            
            choice = input("请选择操作 (1-7): ").strip()
            
            if choice == "1":
                self.handle_sgf_input()
            elif choice == "2":
                self.handle_example_sgf()
            elif choice == "3":
                self.handle_set_interval()
            elif choice == "4":
                self.test_server_connection()
                self.get_server_info()
            elif choice == "5":
                self.test_basic_api_call()
            elif choice == "6":
                self.debug_mode = not self.debug_mode
                self.print_status(f"调试模式: {'开启' if self.debug_mode else '关闭'}", "INFO")
            elif choice == "7":
                self.print_status("退出程序", "INFO")
                break
            else:
                self.print_status("无效选择，请重新输入", "WARNING")

def main():
    """主函数"""
    print("KataGo Analysis HTTP Server SGF 测试工具")
    print("适配Analysis服务API格式")
    print("="*60)
    
    # 解析命令行参数
    #base_url = "http://localhost:8080"
    base_url = "http://192.168.0.249:8080"
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    
    # 创建测试器
    tester = SGFAnalysisTester(base_url)
    
    try:
        # 进入交互模式
        tester.interactive_mode()
    except KeyboardInterrupt:
        print("\n\n程序被用户中断")
    except Exception as e:
        print(f"\n程序异常: {e}")
    
    print("\n感谢使用 KataGo Analysis HTTP 测试工具!")

if __name__ == '__main__':
    main()