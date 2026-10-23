"""Escreve as tabelas em Parquet e cria o banco DuckDB com views de conveniência (§5.3)."""
from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

from . import config
from .parse import Tables, build_tables


def write_tables(frames: dict[str, pd.DataFrame], tables_dir: Path = config.TABLES_DIR,
                 duckdb_path: Path = config.DUCKDB_PATH) -> None:
    tables_dir.mkdir(parents=True, exist_ok=True)
    for name, df in frames.items():
        df.to_parquet(tables_dir / f"{name}.parquet", index=False)
    if duckdb_path.exists():
        duckdb_path.unlink()
    con = duckdb.connect(str(duckdb_path))
    for name in frames:
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM read_parquet('{(tables_dir / f'{name}.parquet').as_posix()}')")
    # Regra do §5.3: estatísticas de abate só com kills válidas.
    con.execute("CREATE VIEW valid_kills AS SELECT * FROM kills WHERE NOT is_self_or_bomb_kill AND NOT is_team_kill")
    con.close()


def load_frames(tables_dir: Path = config.TABLES_DIR) -> dict[str, pd.DataFrame]:
    names = ["matches", "rounds", "round_players", "kills", "plant_snapshot", "defuse_snapshot", "players"]
    return {n: pd.read_parquet(tables_dir / f"{n}.parquet") for n in names}


def build_and_write(raw_dir: Path = config.RAW_DIR) -> tuple[Tables, dict[str, pd.DataFrame]]:
    t = build_tables(raw_dir)
    frames = t.frames()
    write_tables(frames)
    return t, frames
