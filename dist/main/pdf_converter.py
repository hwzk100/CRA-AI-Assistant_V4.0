#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CRA AI Assistant - PDF to Image Converter (Python)
使用 pdf2image 和 PIL 将 PDF 转换为图片
"""

import sys
import json
import os
import tempfile
import shutil
from pathlib import Path

# 重新配置标准输出流为 UTF-8 编码（修复 Windows 中文乱码）
if sys.platform == 'win32':
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except:
        pass

# 检查依赖
try:
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError as e:
    error_result = {
        "success": False,
        "error": f"缺少 Python 依赖: {str(e)}。请运行: pip install pdf2image Pillow"
    }
    # 也输出到stderr用于调试
    print(f"[Python] ERROR: {error_result['error']}", file=sys.stderr)
    sys.stderr.flush()
    print(json.dumps(error_result))
    sys.exit(1)


def check_poppler():
    """检查poppler是否可用"""
    try:
        return shutil.which('pdftoppm') is not None or shutil.which('pdftocairo') is not None
    except:
        return False


def convert_pdf_to_images(pdf_path, max_pages=10):
    """将 PDF 转换为图片"""
    try:
        # 检查poppler是否可用
        if not check_poppler():
            error_msg = "找不到 poppler。Windows用户请安装: https://github.com/oschwartz10612/poppler-windows/releases/"
            print(f"[Python] ERROR: {error_msg}", file=sys.stderr)
            sys.stderr.flush()
            return {
                "success": False,
                "error": error_msg
            }

        # 创建临时目录
        temp_dir = tempfile.gettempdir()
        cache_dir = os.path.join(temp_dir, 'cra-ai-pdf-cache')
        os.makedirs(cache_dir, exist_ok=True)

        print(f"[Python] Converting PDF: {pdf_path}", file=sys.stderr)
        sys.stderr.flush()
        print(f"[Python] Max pages: {max_pages}", file=sys.stderr)
        sys.stderr.flush()

        # 转换 PDF 为图片
        # dpi=300 提供高质量图片
        images = convert_from_path(pdf_path, dpi=200, first_page=1, last_page=max_pages)

        image_paths = []
        pdf_name = Path(pdf_path).stem

        for i, image in enumerate(images, start=1):
            # 保存图片
            output_path = os.path.join(cache_dir, f"{pdf_name}_page_{i}.png")
            image.save(output_path, 'PNG')
            image_paths.append(output_path)
            print(f"[Python] Converted page {i} to {output_path}", file=sys.stderr)
            sys.stderr.flush()

        print(f"[Python] Total pages converted: {len(image_paths)}", file=sys.stderr)
        sys.stderr.flush()

        if not image_paths:
            return {
                "success": False,
                "error": "PDF 转换失败，未能生成任何图片"
            }

        return {
            "success": True,
            "data": image_paths
        }

    except Exception as e:
        error_msg = f"PDF 转换失败: {str(e)}"
        print(f"[Python] ERROR: {error_msg}", file=sys.stderr)
        sys.stderr.flush()
        return {
            "success": False,
            "error": error_msg
        }


if __name__ == "__main__":
    # 从命令行参数读取 JSON 配置
    if len(sys.argv) < 2:
        error_result = {
            "success": False,
            "error": "缺少参数"
        }
        print(json.dumps(error_result))
        sys.exit(1)

    try:
        config = json.loads(sys.argv[1])
        result = convert_pdf_to_images(config.get("filePath"), config.get("maxPages", 10))
        print(json.dumps(result))
        sys.stdout.flush()
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"脚本执行失败: {str(e)}"
        }
        print(f"[Python] ERROR: {error_result['error']}", file=sys.stderr)
        sys.stderr.flush()
        print(json.dumps(error_result))
        sys.stdout.flush()
        sys.exit(1)
