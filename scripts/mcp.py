"""Claude 플러그인용 MCP 실행 래퍼 (설치 없이 src 경로를 잡는다)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
from ksaju.mcp_server import main  # noqa: E402

main()
