"""绕过本机错误 DNS（如 198.18.0.0/15 劫持），强制解析智谱域名。"""

from __future__ import annotations

import logging
import socket
import threading

logger = logging.getLogger(__name__)

# curl --resolve 已验证可用的地址
_HOST_MAP: dict[str, str] = {
    "open.bigmodel.cn": "39.108.52.113",
}
_lock = threading.Lock()
_patched = False
_orig_getaddrinfo = socket.getaddrinfo


def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    mapped = None
    if isinstance(host, str):
        with _lock:
            mapped = _HOST_MAP.get(host)
    if mapped:
        host = mapped
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


def apply_dns_fix() -> None:
    global _patched
    if _patched:
        return
    socket.getaddrinfo = _patched_getaddrinfo  # type: ignore[assignment]
    _patched = True
    # 自检
    try:
        infos = socket.getaddrinfo("open.bigmodel.cn", 443, type=socket.SOCK_STREAM)
        logger.info("DNS fix applied, open.bigmodel.cn -> %s", infos[0][4] if infos else "?")
    except Exception as exc:  # noqa: BLE001
        logger.warning("DNS fix applied but self-check failed: %s", exc)
