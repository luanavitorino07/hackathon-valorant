"""Orquestra métricas e escreve os arquivos estáticos lidos pelo site (§2)."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config, module_a, module_b, module_c
from .derive import Context, build_context
from .dictionaries import MAP_NAMES
from .insights import team_insights
from .privacy import build_aliases, load_salt, write_private_aliases
from .registry import PropRegistry

ACRONYMS = {
    "ufmt", "umc", "ceub", "uscs", "fei", "a2e", "uff", "caap", "ufu", "ufpr", "bbn", "utfpr", "pucc", "pucgo", "usp",
    "ufmg", "ime", "ufg", "ufrj", "ibmec", "fatec", "pg", "gc", "iff", "ufpb", "gdu", "unifesp", "unirio",
}
DISPLAY_OVERRIDES = {"maua": "Mauá", "fametro": "Fametro", "inatel": "Inatel", "unicamp": "Unicamp"}


def display_name(slug: str) -> str:
    parts = []
    for tok in slug.split("_"):
        if tok in ACRONYMS:
            parts.append(tok.upper())
        elif tok in DISPLAY_OVERRIDES:
            parts.append(DISPLAY_OVERRIDES[tok])
        else:
            parts.append(tok.capitalize())
    return " ".join(parts)


class _Enc(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return None if math.isnan(o) else float(o)
        if isinstance(o, (np.bool_,)):
            return bool(o)
        return super().default(o)


def _clean(o):
    if isinstance(o, float) and math.isnan(o):
        return None
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(_clean(obj), cls=_Enc, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def team_matches(ctx: Context, team: str) -> tuple[list[dict], dict[str, int]]:
    m = ctx.matches
    mine = m[(m.team_a == team) | (m.team_b == team)].sort_values(["date", "start_ms", "match_num"])
    tr = ctx.team_rounds[ctx.team_rounds.team == team]
    rounds_by = {mid: g.sort_values("round_num") for mid, g in tr.groupby("match_id")}
    out, index = [], {}
    for i, row in enumerate(mine.itertuples()):
        is_a = row.team_a == team
        g = rounds_by[row.match_id]
        index[row.match_id] = i
        out.append({
            "match_id": row.match_id,
            "date": row.date,
            "source": row.source,
            "map": row.map,
            "opp": row.team_b if is_a else row.team_a,
            "opp_name": display_name(row.team_b if is_a else row.team_a),
            "score_for": int(row.score_a if is_a else row.score_b),
            "score_against": int(row.score_b if is_a else row.score_a),
            "won": row.winner == team,
            "overtime": bool(row.is_overtime),
            "patch": row.patch,
            "rounds": "".join("W" if w else "L" for w in g["won"]),
            "sides": "".join("A" if s == "atk" else "D" for s in g["side"]),
        })
    return out, index


def build_all(frames: dict[str, pd.DataFrame], riot_ids: dict[str, str], out_dir: Path = config.WEB_DATA_DIR,
              real_names: bool = False, teams_filter: list[str] | None = None) -> dict:
    ctx = build_context(frames)
    reg = PropRegistry()
    module_a.register_team_metrics(ctx, reg)
    module_c.register_econ_metrics(ctx, reg)
    rp_players = module_a.register_player_metrics(ctx, reg)
    f, pts, params = module_b.plant_features(ctx)
    module_b.register_postplant_metrics(ctx, reg, f)
    centers = module_b.site_centers(ctx)
    points = module_b.group_points(pts)
    clutches = module_a.clutch_players(ctx)
    pct = module_a.plant_percentiles(ctx)
    mprior = module_a.match_prior(ctx)
    ret = module_c.two_round_returns(ctx)
    ret_table = module_c.returns_table(ret)

    salt = load_salt()
    aliases = build_aliases(frames["players"]["puuid"], salt)
    write_private_aliases(aliases, riot_ids)
    names = riot_ids if real_names else None

    # Sobrescreve no lugar (sem apagar a pasta, para não derrubar o servidor de dev) e remove obsoletos no fim.
    before = set(out_dir.rglob("*.json")) if out_dir.exists() else set()
    for sub in ("teams", "evidence", "maps"):
        (out_dir / sub).mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sizes = {}
    teams_index = []
    teams = teams_filter or ctx.teams
    for team in teams:
        matches, midx = team_matches(ctx, team)
        record = module_a.team_record(ctx, team)
        maps_played = sorted(m for m in record if m != "all")
        plant_prof = {s: module_a.plant_time_profile(ctx, team, s, pct) for s in ["all"] + maps_played}
        units = {u: aliases[u.split("|", 1)[1]] for u in reg.units("all.player.fk") if u.startswith(team + "|")}
        insights = team_insights(reg, team, maps_played, plant_prof, units)
        postplant = module_b.team_postplant(f, points, team, midx, reg)
        econ_slices = {}
        for s in ["all"] + maps_played:
            econ_slices[s] = {
                "share": {b: reg.get(f"{s}.econ.share.{b}", team) for b in module_c.BUYS},
                "win_by_buy": {b: reg.get(f"{s}.econ.win_by_buy.{b}", team) for b in module_c.BUYS},
                "down3": {b: reg.get(f"{s}.econ.down3.{b}", team) for b in module_c.BUYS},
                "eco_after_pistol_loss": reg.get(f"{s}.pistol.after_loss.eco", team),
                "antieco_win": reg.get(f"{s}.econ.antieco_win", team),
                "upset_win": reg.get(f"{s}.econ.upset_win", team),
            }
        team_json = {
            "slug": team,
            "name": display_name(team),
            "generated_at": generated_at,
            "sources": sorted({m["source"] for m in matches}),
            "maps": maps_played,
            "record": record,
            "matches": matches,
            "profile": module_a.team_profile_slices(ctx, team, reg, pct),
            "plant_hist": module_a.team_plant_hist(ctx, team),
            "comps": module_a.compositions(ctx, team, mprior),
            "players": module_a.players_profile(ctx, team, reg, rp_players, clutches, aliases, names),
            "insights": insights,
            "veto": module_a.veto_team(ctx, team, reg),
            "postplant": postplant,
            "economy": {
                "slices": econ_slices,
                "table": module_c.team_econ_table(ctx, team),
                "remaining_full": module_c.remaining_full(ctx, team),
                "anti_eco_losses": module_c.anti_eco_losses(ctx, team, midx),
                "review": module_c.review_rounds(ret, ret_table, team, midx),
                "timelines": module_c.match_timelines(ctx, team, midx),
            },
        }
        sizes[team] = write_json(out_dir / "teams" / f"{team}.json", team_json)

        ev = {}
        for metric in reg.metrics():
            if ".player." in metric:
                continue
            e = reg.evidence(metric, team)
            if e and (e["yes_total"] or e["no_total"]):
                ev[metric] = _ev_refs(e, midx)
        for unit, alias in units.items():
            for metric in reg.metrics():
                if ".player." not in metric:
                    continue
                e = reg.evidence(metric, unit)
                if e and e["yes_total"]:
                    ev[f"{metric}|{alias}"] = _ev_refs(e, midx)
        ev["econ.anti_eco_losses"] = {"yes": sorted([[a["m"], a["r"]] for a in team_json["economy"]["anti_eco_losses"]], key=lambda x: (-x[0], x[1]))[: config.EVIDENCE_MAX],
                                      "no": [], "yes_total": len(team_json["economy"]["anti_eco_losses"]), "no_total": 0}
        write_json(out_dir / "evidence" / f"{team}.json", {"slug": team, "match_ids": [m["match_id"] for m in matches], "metrics": ev})

        teams_index.append({
            "slug": team, "name": display_name(team), "matches": record["all"]["matches"], "wins": record["all"]["wins"],
            "rounds": record["all"]["rounds"], "maps": {m: record[m]["matches"] for m in maps_played},
            "sources": team_json["sources"], "last_date": matches[-1]["date"] if matches else None,
            "insights": len(insights),
        })

    # Mapas (fundo de densidade + centros de site).
    bgs = module_b.map_backgrounds(ctx, params, centers)
    for mp, bg in bgs.items():
        bg["name"] = MAP_NAMES.get(mp, mp.title())
        write_json(out_dir / "maps" / f"{mp}.json", bg)

    m = ctx.matches
    last_stage = m.sort_values("date")["source"].iloc[-1]
    pool = sorted(m.loc[m.source == last_stage, "map"].unique(), key=lambda x: -int((m.loc[m.source == last_stage, "map"] == x).sum()))
    league = {
        "generated_at": generated_at,
        "params": {
            "sample": {"insufficient_below": config.SAMPLE_INSUFFICIENT, "ok_from": config.SAMPLE_OK},
            "cred_level": config.CRED_LEVEL,
            "prob_threshold": config.PROB_THRESHOLD,
            "buy": {"eco_max": config.ECO_MAX, "full_min": config.FULL_MIN, "pistol_rounds": list(config.PISTOL_ROUNDS),
                    "regulation_rounds": config.REGULATION_ROUNDS},
            "veto": {"kappa": config.VETO_KAPPA, "clamp": list(config.VETO_PRIOR_CLAMP)},
            "insight": {"min_n": config.INSIGHT_MIN_N, "share_ratio": config.INSIGHT_SHARE_RATIO, "max_cards": config.INSIGHT_MAX_CARDS},
            "postplant": {"aim_tolerance_deg": 60, "lurk_factor": config.LURK_FACTOR, "aim_min_dist": module_b.AIM_MIN_DIST},
            "prior_fit": {"min_n_per_unit": config.PRIOR_MIN_N_PER_UNIT, "min_strength": config.PRIOR_MIN_STRENGTH,
                          "max_strength": config.PRIOR_MAX_STRENGTH},
            "bootstrap": {"resamples": config.BOOTSTRAP_RESAMPLES, "min_n": config.BOOTSTRAP_MIN_N, "seed": config.SEED},
            "evidence_max": config.EVIDENCE_MAX,
        },
        "priors": {k: reg.prior(k).to_dict() | {"league_k": reg.league(k)[0], "league_n": reg.league(k)[1]}
                   for k in sorted(reg.metrics())},
        "sides": module_a.veto_league(ctx),
        "plant_times": module_a.league_plant_times(ctx),
        "economy": {
            "table": module_c.league_econ_table(ctx),
            "returns": module_c.returns_export(ret_table),
            "share": {b: float((module_c.regulation_decisions(ctx.team_rounds).buy == b).mean()) for b in module_c.BUYS},
            "remaining_full_mean": float(module_c.regulation_decisions(ctx.team_rounds).query("buy == 'full'")["avg_remaining"].mean()),
        },
        "postplant": {
            "archetypes": module_b.archetype_strata(f),
            "label_share": {lab: float(f[f.n_atk > 0][f"is_{lab}"].mean()) for lab in module_b.LABELS},
            "n_plants": int(len(f)),
            "atk_win_by_stratum": {st: module_b.posterior(int(g.atk_won.sum()), len(g), module_b.UNIFORM_PRIOR)
                                   for st, g in f.groupby("stratum")},
        },
    }
    write_json(out_dir / "league.json", league)

    index = {
        "generated_at": generated_at,
        "dataset": {
            "matches": int(len(m)), "rounds": int(len(ctx.rounds)), "teams": len(ctx.teams),
            "players": int(frames["players"]["puuid"].nunique()), "plants": int((ctx.rounds.plant_site != "").sum()),
            "kills": int(len(ctx.valid_kills)), "first_date": m["date"].min(), "last_date": m["date"].max(),
            "sources": [{"source": s, "matches": int(n)} for s, n in m["source"].value_counts().sort_index().items()],
            "maps": [{"map": mp, "name": MAP_NAMES.get(mp, mp), "matches": int(n)} for mp, n in m["map"].value_counts().items()],
        },
        "current_pool": {"source": last_stage, "maps": pool},
        "teams": sorted(teams_index, key=lambda t: (-t["matches"], t["name"])),
        "real_names": bool(real_names),
    }
    write_json(out_dir / "index.json", index)
    written = {out_dir / "index.json", out_dir / "league.json"}
    written |= {out_dir / d / f"{t}.json" for t in teams for d in ("teams", "evidence")}
    written |= {out_dir / "maps" / f"{mp}.json" for mp in bgs}
    if not teams_filter:
        for stale in before - written:
            stale.unlink()
    return {"sizes": sizes, "ctx": ctx, "reg": reg, "features": f}


def _ev_refs(e: dict, midx: dict[str, int]) -> dict:
    """Partidas mais recentes primeiro; no máximo EVIDENCE_MAX rounds por lista."""
    def conv(refs):
        out = sorted(([midx[mid], int(r)] for mid, r in refs if mid in midx), key=lambda x: (-x[0], x[1]))
        return out[: config.EVIDENCE_MAX]
    return {
        "yes": conv(e["yes"]),
        "no": conv(e["no"]),
        "yes_total": e["yes_total"],
        "no_total": e["no_total"],
    }
