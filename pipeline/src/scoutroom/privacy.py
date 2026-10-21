"""Apelidos anônimos estáveis (§1.3, §5.5). PUUID e nick real nunca saem para a web por padrão."""
from __future__ import annotations

import csv
import hashlib
import secrets
from pathlib import Path

from . import config

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sem I, L, O, 0, 1 (ambíguos) -> 31 símbolos


def load_salt(private_dir: Path = config.PRIVATE_DIR) -> str:
    private_dir.mkdir(parents=True, exist_ok=True)
    p = private_dir / "salt.txt"
    if not p.exists():
        p.write_text(secrets.token_hex(16), encoding="utf-8")
    return p.read_text(encoding="utf-8").strip()


def _code(digest: bytes, length: int = 3) -> str:
    v = int.from_bytes(digest[:8], "big")
    out = []
    for _ in range(length):
        v, r = divmod(v, len(ALPHABET))
        out.append(ALPHABET[r])
    return "".join(out)


def build_aliases(puuids, salt: str) -> dict[str, str]:
    """'Jogador K7X' a partir de sha256(sal + puuid); colisões resolvidas rehashando com contador."""
    taken: set[str] = set()
    out: dict[str, str] = {}
    for pu in sorted(set(puuids)):
        i = 0
        while True:
            h = hashlib.sha256(f"{salt}{pu}{'' if i == 0 else i}".encode()).digest()
            code = _code(h)
            if code not in taken:
                break
            i += 1
        taken.add(code)
        out[pu] = f"Jogador {code}"
    return out


def write_private_aliases(aliases: dict[str, str], names: dict[str, str], private_dir: Path = config.PRIVATE_DIR) -> Path:
    p = private_dir / "aliases.csv"
    with open(p, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["alias", "puuid", "riot_id"])
        for pu, a in sorted(aliases.items(), key=lambda kv: kv[1]):
            w.writerow([a, pu, names.get(pu, "")])
    return p
