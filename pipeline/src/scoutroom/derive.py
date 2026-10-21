"""Tabelas derivadas compartilhadas pelos módulos: uma linha por (partida, round, time)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config


def buy_type(avg_loadout: float, round_num: int) -> str:
    if round_num in config.PISTOL_ROUNDS:
        return "pistol"
    if round_num >= config.REGULATION_ROUNDS:
        return "full"
    if avg_loadout < config.ECO_MAX:
        return "eco"
    if avg_loadout < config.FULL_MIN:
        return "force"
    return "full"


def half_of(round_num: int) -> int:
    if round_num < 12:
        return 1
    if round_num < config.REGULATION_ROUNDS:
        return 2
    return 3  # prorrogação


@dataclass
class Context:
    frames: dict[str, pd.DataFrame]
    matches: pd.DataFrame
    rounds: pd.DataFrame       # rounds + map
    team_rounds: pd.DataFrame  # 1 linha por (match, round, time)
    valid_kills: pd.DataFrame
    teams: list[str]
    maps: list[str]


def build_context(frames: dict[str, pd.DataFrame]) -> Context:
    m = frames["matches"].copy()
    r = frames["rounds"].merge(m[["match_id", "map", "date", "source"]], on="match_id", how="left")
    r = r.sort_values(["match_id", "round_num"]).reset_index(drop=True)
    rp = frames["round_players"]

    econ = rp.groupby(["match_id", "round_num", "team_slug"]).agg(
        avg_loadout=("loadout_value", "mean"),
        avg_remaining=("remaining", "mean"),
        avg_spent=("spent", "mean"),
    ).reset_index()
    rp_bank = rp.assign(bank=rp["loadout_value"] + rp["remaining"])
    econ = econ.merge(rp_bank.groupby(["match_id", "round_num", "team_slug"])["bank"].mean().rename("avg_bank").reset_index(),
                      on=["match_id", "round_num", "team_slug"])

    rows = []
    for side_col, opp_col, side in (("atk_team", "def_team", "atk"), ("def_team", "atk_team", "def")):
        part = r[["match_id", "round_num", "map", "date", "source", side_col, opp_col, "winning_team", "winning_role",
                  "plant_site", "plant_time_ms", "result", "ceremony"]].rename(columns={side_col: "team", opp_col: "opp"})
        part["side"] = side
        rows.append(part)
    tr = pd.concat(rows, ignore_index=True)
    tr["won"] = tr["winning_team"] == tr["team"]
    tr["planted"] = tr["plant_site"] != ""
    tr = tr.merge(econ.rename(columns={"team_slug": "team"}), on=["match_id", "round_num", "team"], how="left")
    opp_econ = econ.rename(columns={"team_slug": "opp", "avg_loadout": "opp_avg_loadout",
                                    "avg_remaining": "opp_avg_remaining", "avg_spent": "opp_avg_spent",
                                    "avg_bank": "opp_avg_bank"})
    tr = tr.merge(opp_econ, on=["match_id", "round_num", "opp"], how="left")
    tr["buy"] = [buy_type(v, rn) for v, rn in zip(tr["avg_loadout"], tr["round_num"])]
    tr["opp_buy"] = [buy_type(v, rn) for v, rn in zip(tr["opp_avg_loadout"], tr["round_num"])]
    tr["half"] = tr["round_num"].map(half_of)

    # Placar antes do round e sequência de derrotas (zerada a cada metade, como o bônus de derrota).
    tr = tr.sort_values(["match_id", "team", "round_num"]).reset_index(drop=True)
    g = tr.groupby(["match_id", "team"], sort=False)
    tr["score_for"] = g["won"].cumsum() - tr["won"].astype(int)
    tr["score_against"] = g["won"].transform(lambda s: (~s).cumsum()) - (~tr["won"]).astype(int)
    tr["diff"] = tr["score_for"] - tr["score_against"]
    streaks = np.zeros(len(tr), dtype=int)
    prev_key, prev_half, streak = None, None, 0
    for i, (mid, team, half, won) in enumerate(zip(tr["match_id"], tr["team"], tr["half"], tr["won"])):
        key = (mid, team)
        if key != prev_key or half != prev_half:
            streak = 0
        streaks[i] = streak
        streak = 0 if won else streak + 1
        prev_key, prev_half = key, half
    tr["loss_streak"] = streaks
    tr = tr.sort_values(["match_id", "round_num", "side"]).reset_index(drop=True)

    k = frames["kills"]
    vk = k[~k["is_self_or_bomb_kill"] & ~k["is_team_kill"]].copy()
    teams = sorted(set(m["team_a"]) | set(m["team_b"]))
    maps = list(m["map"].value_counts().index)
    return Context(frames=frames, matches=m, rounds=r, team_rounds=tr, valid_kills=vk, teams=teams, maps=maps)
