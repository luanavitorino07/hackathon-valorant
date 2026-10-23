"""Linha de comando: `scoutroom all` roda auditoria, tabelas, métricas e exportação."""
from __future__ import annotations

import argparse
import time

from . import config


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="scoutroom")
    ap.add_argument("command", choices=["all", "audit", "tables", "export"], nargs="?", default="all")
    ap.add_argument("--real-names", action="store_true",
                    help="inclui nicks reais nos JSON (uso interno; DESLIGADO por padrão; nunca publicar)")
    args = ap.parse_args(argv)

    from .audit import write_audit
    from .dictionaries import write_maps_dictionary
    from .tables import build_and_write

    t0 = time.time()
    tables, frames = build_and_write()
    write_maps_dictionary(tables.map_ids)
    print(f"[tables] {', '.join(f'{k}={len(v)}' for k, v in frames.items())} ({time.time() - t0:.1f}s)")
    if tables.filename_failures:
        print(f"[tables] nomes de arquivo não reconhecidos: {tables.filename_failures}")
    if args.command in ("all", "audit"):
        p = write_audit(tables, frames)
        print(f"[audit] {p}")
    if args.command in ("all", "export"):
        from .export import build_all
        if args.real_names:
            print("[export] ATENÇÃO: --real-names ativo; não publique esta build.")
        res = build_all(frames, tables.riot_ids, real_names=args.real_names)
        big = max(res["sizes"].values())
        print(f"[export] {len(res['sizes'])} times em {config.WEB_DATA_DIR} (maior arquivo: {big / 1024:.0f} KB) "
              f"({time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
