# -*- coding: utf-8 -*-
"""fake-ip（TUN 代理）环境下的 DNS 钉扎助手。

背景：本机若开启 Clash/Mihomo 类 TUN 模式，socket.getaddrinfo 会返回
198.18.0.0/15 的 fake-ip，且 TUN 会按 SNI/域名规则改写路由；东财 push2
接口主机经代理线路会被 WAF 拒绝（502/重置），但直连真实国内 IP 可用。

策略：
1. 用阿里 DoH 解析真实 IP 候选（DoH 失败退回内置 IP）；
2. 对候选 IP 做端到端探测（TLS + 真实 GET 接口，要求 200 且返回 JSON）；
3. 把首个探测通过的 IP 钉扎到 socket.getaddrinfo（仅本进程生效）；
4. 请求失败时可调用 rotate_pin 换下一个候选 IP。

只影响本爬虫进程，不修改系统 hosts / 代理配置。
"""

import json
import socket
import ssl
import urllib.request

DOH_URLS = (
    "https://223.5.5.5/resolve",
    "https://1.12.12.12/resolve",
)

# DoH 不可用时的兜底（东财 CDN IP，可能随时间轮换）
FALLBACK_IPS = {
    "push2.eastmoney.com": ["119.3.232.150", "120.76.218.228", "120.79.191.232"],
    "push2his.eastmoney.com": ["120.79.243.12", "120.79.123.125", "103.220.167.80"],
}

PINNED: dict[str, str] = {}
_original_getaddrinfo = socket.getaddrinfo
_patched = False

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def _doh_resolve(host: str) -> list[str]:
    """通过 DoH JSON 接口解析 A 记录，返回真实 IP 列表。"""
    last_error: Exception | None = None
    for base in DOH_URLS:
        try:
            req = urllib.request.Request(
                f"{base}?name={host}&type=A",
                headers={"Accept": "application/dns-json", "User-Agent": _UA},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            ips = [
                answer["data"]
                for answer in payload.get("Answer", [])
                if answer.get("type") == 1
            ]
            if ips:
                return ips
        except Exception as exc:  # noqa: BLE001 - 逐个 DoH 端点尝试
            last_error = exc
    raise RuntimeError(f"DoH resolve failed for {host}: {last_error}")


def _candidates_for(host: str) -> list[str]:
    """候选 IP = DoH 结果 + 内置兜底，去重保序。"""
    try:
        resolved = _doh_resolve(host)
    except Exception:  # noqa: BLE001 - DoH 失败只影响候选数量
        resolved = []
    seen: set[str] = set()
    unique: list[str] = []
    for ip in [*resolved, *FALLBACK_IPS.get(host, [])]:
        if ip and ip not in seen:
            seen.add(ip)
            unique.append(ip)
    return unique


def _probe_ip(ip: str, host: str, path: str, timeout: float = 8.0) -> bool:
    """端到端探测：连接 ip:443（SNI=host），真实 GET path，要求 200 且返回 JSON。"""
    try:
        with socket.create_connection((ip, 443), timeout=timeout) as sock:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                request = (
                    f"GET {path} HTTP/1.1\r\n"
                    f"Host: {host}\r\n"
                    f"User-Agent: {_UA}\r\n"
                    "Accept: application/json,*/*\r\n"
                    "Connection: close\r\n\r\n"
                )
                tls.sendall(request.encode("ascii"))
                chunks = []
                while sum(len(c) for c in chunks) < 65536:
                    chunk = tls.recv(8192)
                    if not chunk:
                        break
                    chunks.append(chunk)
        body = b"".join(chunks).decode("utf-8", "replace")
        head, _, payload = body.partition("\r\n\r\n")
        status_ok = head.split(" ")[1] == "200" if " " in head else False
        json_ok = payload.lstrip().startswith("{")
        return status_ok and json_ok
    except OSError:
        return False


def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    name = host.decode() if isinstance(host, (bytes, bytearray)) else host
    ip = PINNED.get(name)
    if not ip:
        return _original_getaddrinfo(host, port, family, type, proto, flags)
    if isinstance(port, str):
        try:
            port = int(port)
        except ValueError:
            port = 0
    return [
        (socket.AddressFamily.AF_INET, socket.SocketKind.SOCK_STREAM, 6, "", (ip, port)),
    ]


def _ensure_patched() -> None:
    global _patched
    if not _patched and PINNED:
        socket.getaddrinfo = _patched_getaddrinfo
        _patched = True


def pin_hosts(hosts_with_paths: dict[str, str]) -> dict[str, str]:
    """探测并钉扎 {域名: 探测路径}，返回 {域名: 选中的真实 IP}。"""
    for host, path in hosts_with_paths.items():
        if host in PINNED:
            continue
        for ip in _candidates_for(host):
            if _probe_ip(ip, host, path):
                PINNED[host] = ip
                break
    _ensure_patched()
    return dict(PINNED)


def rotate_pin(host: str, path: str) -> str | None:
    """当前钉扎失效时换下一个候选 IP；返回新 IP 或 None。"""
    old = PINNED.pop(host, None)
    for ip in _candidates_for(host):
        if ip == old:
            continue
        if _probe_ip(ip, host, path):
            PINNED[host] = ip
            _ensure_patched()
            return ip
    return None
