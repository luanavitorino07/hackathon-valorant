"""Módulo B (§8): playbook de pós-plant (formações no instante do plant)."""
from __future__ import annotations

import math
from collections import Counter

import numpy as np
import pandas as pd

from . import config
from .derive import Context
from .registry import PropRegistry
from .stats import UNIFORM_PRIOR, beta_moments, is_probable, median_summary, posterior, prob_greater

LABELS = ("compact", "open", "lurk")
STRATA = ("le_-1", "eq_0", "ge_+1")
AIM_MIN_DIST = 150.0  # atacante colado no spike (ex.: quem plantou) não entra no alinhamento da mira


def stratum_of(adv: int) -> str:
    if adv <= -1:
        return "le_-1"
    if adv == 0:
        return "eq_0"
    return "ge_+1"


def circ_diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    d = np.abs((a - b) % (2 * math.pi))
    return np.minimum(d, 2 * math.pi - d)


def site_centers(ctx: Context) -> pd.DataFrame:
    r = ctx.rounds[ctx.rounds.plant_site != ""]
    return r.groupby(["map", "plant_site"]).agg(cx=("plant_x", "median"), cy=("plant_y", "median"), n=("plant_x", "size")).reset_index()


def plant_features(ctx: Context) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """Uma linha por plant com features da formação; retorna também os pontos e os parâmetros da liga."""
    r = ctx.rounds[ctx.rounds.plant_site != ""][["match_id", "round_num", "map", "plant_site", "plant_time_ms",
                                                  "plant_x", "plant_y", "atk_team", "def_team", "winning_role"]].copy()
    snap = ctx.frames["plant_snapshot"]
    rp = ctx.frames["round_players"][["match_id", "round_num", "puuid", "spent", "round_damage", "round_kills_raw"]]
    pts = snap.merge(rp, on=["match_id", "round_num", "puuid"], how="left", suffixes=("", "_rp"))
    pts = pts.merge(r[["match_id", "round_num", "map", "plant_site", "plant_x", "plant_y"]], on=["match_id", "round_num"])
    pts["dist"] = np.hypot(pts["x"] - pts["plant_x"], pts["y"] - pts["plant_y"])
    to_plant = np.arctan2(pts["plant_y"] - pts["y"], pts["plant_x"] - pts["x"]) % (2 * math.pi)
    pts["aim_ok"] = circ_diff(pts["view_rad"].to_numpy(), to_plant.to_numpy()) <= config.AIM_TOLERANCE_RAD
    pts["afk"] = (pts["spent"].fillna(0) == 0) & (pts["round_damage"].fillna(0) == 0) & (pts["round_kills_raw"].fillna(0) == 0)

    atk = pts[pts.role == "atk"]
    R = atk.groupby(["map", "plant_site"])["dist"].median().rename("R")
    pts = pts.merge(R.reset_index(), on=["map", "plant_site"], how="left")
    atk = pts[pts.role == "atk"]
    dfn = pts[pts.role == "def"]

    key = ["match_id", "round_num"]
    fa = atk.groupby(key).agg(
        n_atk=("dist", "size"),
        mean_dist=("dist", "mean"),
        sd_dist=("dist", lambda d: float(np.std(d, ddof=0)) if len(d) >= 2 else np.nan),
        n_on_site=("dist", lambda d: 0),  # preenchido abaixo
    )
    atk_on = atk.assign(on=atk["dist"] < atk["R"]).groupby(key)["on"].sum()
    fa["n_on_site"] = atk_on
    aim_pool = atk[atk["dist"] >= AIM_MIN_DIST]
    fa["aim_frac"] = aim_pool.groupby(key)["aim_ok"].mean()
    lurkers = atk[(atk["dist"] > config.LURK_FACTOR * atk["R"]) & ~atk["afk"]].groupby(key).size()
    fa["n_lurk"] = lurkers
    fd = dfn.groupby(key).agg(n_def=("dist", "size"), def_mean_dist=("dist", "mean"))
    f = r.set_index(key).join(fa).join(fd).reset_index()
    f[["n_atk", "n_def", "n_on_site", "n_lurk"]] = f[["n_atk", "n_def", "n_on_site", "n_lurk"]].fillna(0).astype(int)
    f["adv"] = f["n_atk"] - f["n_def"]
    f["stratum"] = f["adv"].map(stratum_of)
    f["atk_won"] = f["winning_role"] == "Attacker"

    params = {}
    for (mp, site), g in f.groupby(["map", "plant_site"]):
        has = g[g.n_atk > 0]
        multi = g[g.n_atk >= 2]
        params[(mp, site)] = {
            "R": float(R.get((mp, site), np.nan)),
            "compact_max": float(has["mean_dist"].quantile(1 / 3)) if len(has) else np.nan,
            "open_min": float(multi["sd_dist"].quantile(2 / 3)) if len(multi) else np.nan,
            "def_dist_median": float(g["def_mean_dist"].median()) if g["def_mean_dist"].notna().any() else np.nan,
            "n": int(len(g)),
        }
    pr = f.apply(lambda row: params[(row["map"], row["plant_site"])], axis=1, result_type="expand")
    f["is_compact"] = (f["n_atk"] > 0) & (f["mean_dist"] <= pr["compact_max"])
    f["is_open"] = (f["n_atk"] >= 2) & (f["sd_dist"] >= pr["open_min"])
    f["is_lurk"] = f["n_lurk"] >= 1
    f["def_near"] = f["def_mean_dist"] <= pr["def_dist_median"]
    return f, pts, params


def labels_of(row) -> list[str]:
    return [lab for lab in LABELS if row[f"is_{lab}"]]


def archetype_strata(f: pd.DataFrame) -> list[dict]:
    """Taxa de vitória do ataque com/sem cada rótulo, dentro de cada estrato de vantagem numérica."""
    out = []
    for lab in LABELS:
        col = f"is_{lab}"
        for st in STRATA:
            g = f[(f.stratum == st) & (f.n_atk > 0)]
            w, wo = g[g[col]], g[~g[col]]
            a = posterior(int(w.atk_won.sum()), len(w), UNIFORM_PRIOR) if len(w) else None
            b = posterior(int(wo.atk_won.sum()), len(wo), UNIFORM_PRIOR) if len(wo) else None
            p = None
            if a and b:
                ma, va = beta_moments(a["k"], a["n"], UNIFORM_PRIOR)
                mb, vb = beta_moments(b["k"], b["n"], UNIFORM_PRIOR)
                p = round(prob_greater(ma, va, mb, vb), 4)
            out.append({"label": lab, "stratum": st, "with": a, "without": b, "p_with_gt_without": p,
                        "probable": bool(p is not None and is_probable(p) and a["badge"] != "insufficient" and b["badge"] != "insufficient")})
    return out


def register_postplant_metrics(ctx: Context, reg: PropRegistry, f: pd.DataFrame) -> None:
    """Taxa de vitória no pós-plant por mapa/site (para o resumo por time)."""
    f = f.assign(team=f["atk_team"])
    for (mp, site), g in f.groupby(["map", "plant_site"]):
        reg.add_frame(f"{mp}.atk.postplant_win.{site}", g, "team", "atk_won")
    g = f.assign(team=f["def_team"], def_won=~f["atk_won"])
    for (mp, site), gg in g.groupby(["map", "plant_site"]):
        reg.add_frame(f"{mp}.def.postplant_win.{site}", gg, "team", "def_won")


def group_points(pts: pd.DataFrame) -> dict:
    """(match_id, round_num) -> {"atk": [[x, y, view]], "def": [...]} calculado uma vez para a liga toda."""
    out: dict = {}
    for row in pts[["match_id", "round_num", "role", "x", "y", "view_rad"]].itertuples(index=False):
        d = out.setdefault((row.match_id, int(row.round_num)), {"atk": [], "def": []})
        d[row.role].append([int(row.x), int(row.y), round(float(row.view_rad), 2)])
    return out


def _num(v, nd=None):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return round(float(v), nd) if nd is not None else round(float(v))


def team_postplant(f: pd.DataFrame, points: dict, team: str, match_index: dict[str, int],
                   reg: PropRegistry) -> dict:
    mine = f[(f.atk_team == team) | (f.def_team == team)].sort_values(["match_id", "round_num"])
    plants = []
    for row in mine.itertuples(index=False):
        g = points.get((row.match_id, int(row.round_num)))
        if g is None:
            continue
        has_def = not (isinstance(row.def_mean_dist, float) and math.isnan(row.def_mean_dist))
        plants.append({
            "m": match_index[row.match_id],
            "r": int(row.round_num),
            "map": row.map,
            "site": row.plant_site,
            "side": "atk" if row.atk_team == team else "def",
            "t": round(float(row.plant_time_ms) / 1000.0, 1),
            "atk_won": bool(row.atk_won),
            "adv": int(row.adv),
            "stratum": row.stratum,
            "labels": [lab for lab in LABELS if getattr(row, f"is_{lab}")],
            "def_near": bool(row.def_near) if has_def else None,
            "mean_dist": _num(row.mean_dist),
            "def_dist": _num(row.def_mean_dist),
            "aim": _num(row.aim_frac, 2),
            "p": [int(row.plant_x), int(row.plant_y)],
            "atk": g["atk"],
            "def": g["def"],
        })
    summary = []
    att = mine[mine.atk_team == team]
    for (mp, site), g in att.groupby(["map", "plant_site"]):
        lab_counts = {lab: int(g[f"is_{lab}"].sum()) for lab in LABELS if g[f"is_{lab}"].sum() > 0}
        top = max(lab_counts.items(), key=lambda kv: kv[1]) if lab_counts else (None, 0)
        summary.append({
            "map": mp, "site": site, "n": int(len(g)),
            "top_label": top[0], "top_label_n": int(top[1]),
            "label_counts": lab_counts,
            "postplant_win": reg.get(f"{mp}.atk.postplant_win.{site}", team),
            "plant_time": median_summary((g["plant_time_ms"] / 1000.0).tolist()),
        })
    dsum = []
    de = mine[mine.def_team == team]
    for (mp, site), g in de.groupby(["map", "plant_site"]):
        valid = g[g.def_mean_dist.notna()]
        dsum.append({
            "map": mp, "site": site, "n": int(len(g)),
            "postplant_win": reg.get(f"{mp}.def.postplant_win.{site}", team),
            "def_near": int(valid.def_near.sum()), "def_near_n": int(len(valid)),
            "def_dist_median": round(float(valid.def_mean_dist.median())) if len(valid) else None,
        })
    return {"plants": plants, "summary_atk": summary, "summary_def": dsum}


def map_backgrounds(ctx: Context, params: dict, centers: pd.DataFrame, grid: int = 112) -> dict:
    """D12: mapa de densidade com posições reais da liga (sem arte da Riot)."""
    k = ctx.frames["kills"].merge(ctx.matches[["match_id", "map"]], on="match_id")
    s = ctx.frames["plant_snapshot"].merge(ctx.matches[["match_id", "map"]], on="match_id")
    out = {}
    for mp in ctx.maps:
        xs = np.concatenate([k.loc[k["map"] == mp, "victim_x"].dropna().to_numpy(float), s.loc[s["map"] == mp, "x"].to_numpy(float)])
        ys = np.concatenate([k.loc[k["map"] == mp, "victim_y"].dropna().to_numpy(float), s.loc[s["map"] == mp, "y"].to_numpy(float)])
        if xs.size == 0:
            continue
        x0, x1 = np.percentile(xs, [0.5, 99.5])
        y0, y1 = np.percentile(ys, [0.5, 99.5])
        span = max(x1 - x0, y1 - y0) * 1.08
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        x0, x1, y0, y1 = cx - span / 2, cx + span / 2, cy - span / 2, cy + span / 2
        # Orientação do minimapa: coluna = y do jogo, linha = −x do jogo (eixos trocados).
        H, _, _ = np.histogram2d(-xs, ys, bins=grid, range=[[-x1, -x0], [y0, y1]])
        Hn = np.log1p(H)
        Hn = (255 * Hn / Hn.max()).astype(int) if Hn.max() > 0 else Hn.astype(int)
        sites = {}
        for _, c in centers[centers["map"] == mp].iterrows():
            p = params.get((mp, c.plant_site), {})
            sites[c.plant_site] = {
                "cx": round(float(c.cx)), "cy": round(float(c.cy)), "n": int(c.n),
                "R": round(p.get("R", float("nan"))) if not math.isnan(p.get("R", float("nan"))) else None,
                "compact_max": round(p.get("compact_max", 0)) if not math.isnan(p.get("compact_max", float("nan"))) else None,
                "open_min": round(p.get("open_min", 0)) if not math.isnan(p.get("open_min", float("nan"))) else None,
                "def_dist_median": round(p.get("def_dist_median", 0)) if not math.isnan(p.get("def_dist_median", float("nan"))) else None,
            }
        out[mp] = {
            "map": mp,
            "bounds": {"xmin": round(x0), "xmax": round(x1), "ymin": round(y0), "ymax": round(y1)},
            "grid": grid,
            "density": Hn.flatten().tolist(),
            "sites": sites,
            "n_points": int(xs.size),
        }
    return out
