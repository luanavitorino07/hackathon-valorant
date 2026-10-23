"""Módulo C (§9): auditoria de economia."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import config
from .derive import Context
from .registry import PropRegistry
from .stats import UNIFORM_PRIOR, is_probable, mean_summary, posterior, prob_greater, sample_badge

BUYS = ("eco", "force", "full")
DIFF_BUCKETS = ("le_-3", "-2_-1", "0", "1_2", "ge_3")
STREAK_BUCKETS = ("0", "1", "2", "3+")


def diff_bucket(d: int) -> str:
    if d <= -3:
        return "le_-3"
    if d < 0:
        return "-2_-1"
    if d == 0:
        return "0"
    if d <= 2:
        return "1_2"
    return "ge_3"


def streak_bucket(s: int) -> str:
    return "3+" if s >= 3 else str(s)


def regulation_decisions(tr: pd.DataFrame) -> pd.DataFrame:
    """Rounds com decisão de compra (exclui pistols e prorrogação)."""
    return tr[(tr.round_num < config.REGULATION_ROUNDS) & (~tr.round_num.isin(config.PISTOL_ROUNDS))]


def register_econ_metrics(ctx: Context, reg: PropRegistry) -> None:
    tr = ctx.team_rounds
    for s in ["all"] + ctx.maps:
        t = tr if s == "all" else tr[tr["map"] == s]
        dec = regulation_decisions(t)
        down3 = dec[dec["diff"] <= -3]
        for b in BUYS:
            reg.add_frame(f"{s}.econ.down3.{b}", down3, "team", down3["buy"] == b)
            reg.add_frame(f"{s}.econ.share.{b}", dec, "team", dec["buy"] == b)
            sub = dec[dec.buy == b]
            reg.add_frame(f"{s}.econ.win_by_buy.{b}", sub, "team", "won")
        anti = dec[(dec.buy == "full") & (dec.opp_buy == "eco")]
        reg.add_frame(f"{s}.econ.antieco_win", anti, "team", "won")
        vs_full = dec[(dec.buy != "full") & (dec.opp_buy == "full")]
        reg.add_frame(f"{s}.econ.upset_win", vs_full, "team", "won")


def league_econ_table(ctx: Context) -> list[dict]:
    """Taxa de vitória por (tipo próprio × tipo do adversário × lado). D9: Beta(k+1, n−k+1)."""
    tr = ctx.team_rounds
    out = []
    for (own, opp, side), g in tr.groupby(["buy", "opp_buy", "side"]):
        if (own == "pistol") != (opp == "pistol"):
            continue
        p = posterior(int(g.won.sum()), len(g), UNIFORM_PRIOR)
        out.append({"own": own, "opp": opp, "side": side, **p})
    return out


def team_econ_table(ctx: Context, team: str) -> list[dict]:
    tr = ctx.team_rounds
    t = tr[tr.team == team]
    out = []
    for (own, opp), g in t.groupby(["buy", "opp_buy"]):
        if (own == "pistol") != (opp == "pistol"):
            continue
        lg = tr[(tr.buy == own) & (tr.opp_buy == opp)]
        p = posterior(int(g.won.sum()), len(g), UNIFORM_PRIOR)
        out.append({"own": own, "opp": opp, **p, "league": round(float(lg.won.mean()), 4), "league_n": int(len(lg))})
    return out


def two_round_returns(ctx: Context) -> pd.DataFrame:
    """§9.4: para cada decisão em contexto comparável, média de rounds vencidos em t e t+1 (mesma metade)."""
    tr = ctx.team_rounds
    nxt = tr[["match_id", "team", "round_num", "won"]].copy()
    nxt["round_num"] = nxt["round_num"] - 1
    d = regulation_decisions(tr)
    d = d[((d.round_num >= 0) & (d.round_num <= 10)) | ((d.round_num >= 12) & (d.round_num <= 22))]
    d = d.merge(nxt.rename(columns={"won": "won_next"}), on=["match_id", "team", "round_num"], how="inner")
    d["ret"] = d["won"].astype(int) + d["won_next"].astype(int)
    d["diff_b"] = d["diff"].map(diff_bucket)
    d["streak_b"] = d["loss_streak"].map(streak_bucket)
    return d


def returns_table(d: pd.DataFrame) -> pd.DataFrame:
    g = d.groupby(["diff_b", "streak_b", "side", "buy"])["ret"]
    t = g.agg(["mean", "std", "size"]).reset_index().rename(columns={"size": "n"})
    return t


def review_rounds(d: pd.DataFrame, table: pd.DataFrame, team: str, match_index: dict[str, int]) -> list[dict]:
    """Rounds 'para revisar': decisão com retorno histórico claramente abaixo da alternativa mais comum, e o time perdeu."""
    ctxs = {}
    for key, g in table.groupby(["diff_b", "streak_b", "side"]):
        ctxs[key] = {row.buy: row for row in g.itertuples()}
    out = []
    mine = d[(d.team == team) & (~d.won)]
    for row in mine.itertuples():
        opts = ctxs.get((row.diff_b, row.streak_b, row.side), {})
        if not opts:
            continue
        alt_buy = max(opts.values(), key=lambda r: r.n).buy
        if alt_buy == row.buy:
            continue
        dec, alt = opts.get(row.buy), opts[alt_buy]
        if dec is None or dec.n < config.SAMPLE_OK or alt.n < config.SAMPLE_OK:
            continue
        va = (alt.std ** 2) / alt.n if alt.n > 1 and not math.isnan(alt.std) else 0.0
        vd = (dec.std ** 2) / dec.n if dec.n > 1 and not math.isnan(dec.std) else 0.0
        p = prob_greater(alt.mean, va, dec.mean, vd)
        if p <= config.PROB_THRESHOLD or alt.mean - dec.mean < config.REVIEW_MIN_GAP:
            continue
        need = {"full": config.FULL_MIN, "force": config.ECO_MAX, "eco": 0}[alt_buy]
        if row.avg_bank < need:
            continue
        out.append({
            "m": match_index[row.match_id], "r": int(row.round_num), "map": row.map, "side": row.side,
            "buy": row.buy, "alt": alt_buy, "diff": int(row.diff), "streak": int(row.loss_streak),
            "score": f"{int(row.score_for)}–{int(row.score_against)}",
            "ret_buy": round(float(dec.mean), 3), "n_buy": int(dec.n),
            "ret_alt": round(float(alt.mean), 3), "n_alt": int(alt.n),
            "p_alt_gt": round(p, 4),
            "avg_loadout": round(float(row.avg_loadout)), "avg_bank": round(float(row.avg_bank)), "opp_buy": row.opp_buy,
        })
    return out


def remaining_full(ctx: Context, team: str) -> dict:
    tr = regulation_decisions(ctx.team_rounds)
    mine = tr[(tr.team == team) & (tr.buy == "full")]
    league = tr[tr.buy == "full"]
    s = mean_summary(mine["avg_remaining"].tolist())
    s["league_mean"] = round(float(league["avg_remaining"].mean()), 1)
    return s


def anti_eco_losses(ctx: Context, team: str, match_index: dict[str, int]) -> list[dict]:
    tr = regulation_decisions(ctx.team_rounds)
    lost = tr[(tr.team == team) & (tr.buy == "full") & (tr.opp_buy == "eco") & (~tr.won)]
    return [{"m": match_index[r.match_id], "r": int(r.round_num), "map": r.map, "side": r.side,
             "thrifty": r.ceremony == "CeremonyThrifty", "avg_loadout": round(float(r.avg_loadout)),
             "opp_avg_loadout": round(float(r.opp_avg_loadout)), "result": r.result} for r in lost.itertuples()]


def match_timelines(ctx: Context, team: str, match_index: dict[str, int]) -> dict:
    tr = ctx.team_rounds
    mine = tr[tr.team == team].sort_values(["match_id", "round_num"])
    out = {}
    for mid, g in mine.groupby("match_id", sort=False):
        out[str(match_index[mid])] = [
            [int(r.round_num), int(round(r.avg_loadout)), int(round(r.opp_avg_loadout)), r.buy, r.opp_buy,
             1 if r.won else 0, r.side, r.ceremony.replace("Ceremony", "")]
            for r in g.itertuples()
        ]
    return out


def returns_export(table: pd.DataFrame) -> list[dict]:
    out = []
    for r in table.itertuples():
        out.append({"diff": r.diff_b, "streak": r.streak_b, "side": r.side, "buy": r.buy,
                    "mean": round(float(r.mean), 3), "sd": round(float(r.std), 3) if not math.isnan(r.std) else None,
                    "n": int(r.n), "badge": sample_badge(int(r.n))})
    return out
