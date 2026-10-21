"""Módulo A (§7): perfil do time, jogadores-chave, composições e dados do Veto."""
from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np
import pandas as pd

from . import config
from .derive import Context
from .dictionaries import agent_name, agent_role
from .registry import PropRegistry
from .stats import median_summary, posterior, fit_beta_prior, sample_badge

BUYS = ("eco", "force", "full")


def slices_of(ctx: Context) -> list[str]:
    return ["all"] + ctx.maps


def slice_rounds(tr: pd.DataFrame, s: str) -> pd.DataFrame:
    return tr if s == "all" else tr[tr["map"] == s]


def plant_terciles(ctx: Context) -> dict[str, tuple[float, float]]:
    r = ctx.rounds[ctx.rounds["plant_site"] != ""]
    out = {}
    for m, g in r.groupby("map"):
        t = g["plant_time_ms"].astype(float)
        out[m] = (float(t.quantile(1 / 3)), float(t.quantile(2 / 3)))
    return out


def plant_percentiles(ctx: Context) -> pd.DataFrame:
    """Percentil de cada plant dentro da distribuição da liga no mesmo mapa (0 = mais rápido)."""
    r = ctx.rounds[ctx.rounds["plant_site"] != ""][["match_id", "round_num", "map", "plant_time_ms"]].copy()
    r["pct"] = r.groupby("map")["plant_time_ms"].rank(pct=True, method="average")
    return r


def register_team_metrics(ctx: Context, reg: PropRegistry) -> None:
    tr = ctx.team_rounds
    terc = plant_terciles(ctx)
    for s in slices_of(ctx):
        t = slice_rounds(tr, s)
        atk, de = t[t.side == "atk"], t[t.side == "def"]
        reg.add_frame(f"{s}.atk.win", atk, "team", "won")
        reg.add_frame(f"{s}.def.win", de, "team", "won")
        reg.add_frame(f"{s}.atk.plant_rate", atk, "team", "planted")
        planted = atk[atk.planted]
        reg.add_frame(f"{s}.atk.postplant_win", planted, "team", "won")
        reg.add_frame(f"{s}.def.no_plant", de, "team", ~de["planted"])
        reg.add_frame(f"{s}.def.retake", de[de.planted], "team", "won")
        thr = planted["map"].map(lambda m: terc[m][0])
        thr2 = planted["map"].map(lambda m: terc[m][1])
        reg.add_frame(f"{s}.atk.plant_fast", planted, "team", planted["plant_time_ms"] < thr)
        reg.add_frame(f"{s}.atk.plant_late", planted, "team", planted["plant_time_ms"] > thr2)
        if s != "all":
            sites = sorted(set(ctx.rounds.loc[(ctx.rounds["map"] == s) & (ctx.rounds["plant_site"] != ""), "plant_site"]))
            for x in sites:
                reg.add_frame(f"{s}.atk.site.{x}", planted, "team", planted["plant_site"] == x)
                against = de[de.planted]
                reg.add_frame(f"{s}.def.opp_site.{x}", against, "team", against["plant_site"] == x)
                reg.add_frame(f"{s}.def.retake.{x}", against[against.plant_site == x], "team", "won")
        pis = t[t.round_num.isin(config.PISTOL_ROUNDS)]
        reg.add_frame(f"{s}.pistol.win", pis, "team", "won")
        reg.add_frame(f"{s}.pistol.atk.win", pis[pis.side == "atk"], "team", "won")
        reg.add_frame(f"{s}.pistol.def.win", pis[pis.side == "def"], "team", "won")
        # Round seguinte ao pistol (1 e 13): tipo de compra após ganhar/perder.
        nxt = t[t.round_num.isin([p + 1 for p in config.PISTOL_ROUNDS])].copy()
        prev = t[t.round_num.isin(config.PISTOL_ROUNDS)][["match_id", "team", "round_num", "won"]].copy()
        prev["round_num"] = prev["round_num"] + 1
        nxt = nxt.merge(prev.rename(columns={"won": "won_pistol"}), on=["match_id", "team", "round_num"], how="inner")
        for outcome, mask in (("after_win", nxt["won_pistol"]), ("after_loss", ~nxt["won_pistol"])):
            sub = nxt[mask]
            for b in BUYS:
                reg.add_frame(f"{s}.pistol.{outcome}.{b}", sub, "team", sub["buy"] == b)
            reg.add_frame(f"{s}.pistol.{outcome}.win", sub, "team", "won")


def team_record(ctx: Context, team: str) -> dict:
    m = ctx.matches
    mine = m[(m.team_a == team) | (m.team_b == team)]
    tr = ctx.team_rounds[ctx.team_rounds.team == team]
    out = {}
    for s in ["all"] + sorted(mine["map"].unique()):
        mm = mine if s == "all" else mine[mine["map"] == s]
        t = tr if s == "all" else tr[tr["map"] == s]
        wins = int((mm.winner == team).sum())
        out[s] = {"matches": int(len(mm)), "wins": wins, "rounds": int(len(t)), "rounds_won": int(t.won.sum()),
                  "atk_rounds": int((t.side == "atk").sum()), "def_rounds": int((t.side == "def").sum())}
    return out


def plant_time_profile(ctx: Context, team: str, s: str, pct: pd.DataFrame) -> dict:
    tr = slice_rounds(ctx.team_rounds, s)
    planted = tr[(tr.team == team) & (tr.side == "atk") & tr.planted]
    summ = median_summary((planted["plant_time_ms"] / 1000.0).tolist())
    p = planted.merge(pct[["match_id", "round_num", "pct"]], on=["match_id", "round_num"], how="left")
    med_pct = float(p["pct"].median()) if len(p) else None
    cls = None
    if med_pct is not None and len(p) >= config.SAMPLE_INSUFFICIENT:
        cls = "fast" if med_pct < 1 / 3 else ("late" if med_pct > 2 / 3 else "medium")
    summ["median_pct"] = round(med_pct, 3) if med_pct is not None else None
    summ["class"] = cls
    return summ


def league_plant_times(ctx: Context) -> dict:
    r = ctx.rounds[ctx.rounds["plant_site"] != ""]
    out = {}
    terc = plant_terciles(ctx)
    for m, g in r.groupby("map"):
        secs = (g["plant_time_ms"] / 1000.0)
        hist, edges = np.histogram(secs, bins=np.arange(0, 111, 5))
        out[m] = {
            "summary": median_summary(secs.tolist()),
            "terciles_s": [round(terc[m][0] / 1000, 1), round(terc[m][1] / 1000, 1)],
            "hist": {"edges": edges.tolist(), "counts": hist.tolist()},
            "by_site": {x: median_summary((gg["plant_time_ms"] / 1000.0).tolist()) for x, gg in g.groupby("plant_site")},
        }
    return out


def team_plant_hist(ctx: Context, team: str) -> dict:
    tr = ctx.team_rounds
    planted = tr[(tr.team == team) & (tr.side == "atk") & tr.planted]
    out = {}
    for m, g in planted.groupby("map"):
        hist, _ = np.histogram(g["plant_time_ms"] / 1000.0, bins=np.arange(0, 111, 5))
        out[m] = hist.tolist()
    hist, _ = np.histogram(planted["plant_time_ms"] / 1000.0, bins=np.arange(0, 111, 5))
    out["all"] = hist.tolist()
    return out


def compositions(ctx: Context, team: str, match_prior) -> dict:
    pl = ctx.frames["players"]
    m = ctx.matches
    mine = pl[pl.team_slug == team].merge(m[["match_id", "map", "winner"]], on="match_id")
    out = {}
    for mp, g in mine.groupby("map"):
        per_match = g.groupby("match_id").agg(agents=("agent_guid", lambda a: tuple(sorted(a))), winner=("winner", "first"))
        n_matches = len(per_match)
        pick = Counter(a for comp in per_match["agents"] for a in set(comp))
        agents = [{"agent": agent_name(a), "role": agent_role(a), "matches": c, "pct": round(c / n_matches, 4)}
                  for a, c in pick.most_common()]
        comps = Counter(per_match["agents"])
        top_comp, top_n = comps.most_common(1)[0]
        wins = int(((per_match["agents"] == top_comp) & (per_match["winner"] == team)).sum())
        top = posterior(wins, top_n, match_prior)
        top["agents"] = sorted(agent_name(a) for a in top_comp)
        out[mp] = {"matches": n_matches, "agents": agents, "top_comp": top,
                   "distinct_comps": len(comps)}
    return out


def first_events(ctx: Context) -> pd.DataFrame:
    """Primeiro abate válido de cada round (matador = First Kill, vítima = First Death)."""
    vk = ctx.valid_kills.sort_values(["match_id", "round_num", "t_ms", "t_game_ms"])
    return vk.groupby(["match_id", "round_num"], sort=False).head(1)[["match_id", "round_num", "killer", "victim"]]


def clutch_players(ctx: Context) -> pd.DataFrame:
    """D10: quem fez o clutch em rounds com CeremonyClutch."""
    r = ctx.rounds[ctx.rounds["ceremony"] == "CeremonyClutch"]
    k = ctx.frames["kills"]
    rp = ctx.frames["round_players"]
    rows = []
    for _, row in r.iterrows():
        key = (row.match_id, row.round_num)
        kk = k[(k.match_id == key[0]) & (k.round_num == key[1])]
        dead = set(kk["victim"])
        team = rp[(rp.match_id == key[0]) & (rp.round_num == key[1]) & (rp.team_slug == row.winning_team)]
        alive = [p for p in team["puuid"] if p not in dead]
        if not alive:
            continue
        if len(alive) > 1:
            vk = ctx.valid_kills
            kc = vk[(vk.match_id == key[0]) & (vk.round_num == key[1])]["killer"].value_counts()
            alive.sort(key=lambda p: -kc.get(p, 0))
        rows.append({"match_id": key[0], "round_num": int(key[1]), "puuid": alive[0], "team": row.winning_team})
    return pd.DataFrame(rows, columns=["match_id", "round_num", "puuid", "team"])


def register_player_metrics(ctx: Context, reg: PropRegistry) -> pd.DataFrame:
    rp = ctx.frames["round_players"].merge(ctx.matches[["match_id", "map"]], on="match_id")
    fe = first_events(ctx)
    rp = rp.merge(fe, on=["match_id", "round_num"], how="left")
    rp["unit"] = rp["team_slug"] + "|" + rp["puuid"]
    rp["is_fk"] = rp["killer"] == rp["puuid"]
    rp["is_fd"] = rp["victim"] == rp["puuid"]
    for s in slices_of(ctx):
        t = rp if s == "all" else rp[rp["map"] == s]
        reg.add_frame(f"{s}.player.fk", t, "unit", "is_fk")
        reg.add_frame(f"{s}.player.fd", t, "unit", "is_fd")
    return rp


def players_profile(ctx: Context, team: str, reg: PropRegistry, rp: pd.DataFrame, clutches: pd.DataFrame,
                    alias_of: dict[str, str], real_names: dict[str, str] | None) -> dict:
    pl = ctx.frames["players"].merge(ctx.matches[["match_id", "map"]], on="match_id")
    mine = pl[pl.team_slug == team]
    out = {}
    for s in ["all"] + sorted(mine["map"].unique()):
        g = mine if s == "all" else mine[mine["map"] == s]
        rows = []
        for pu, pg in g.groupby("puuid"):
            unit = f"{team}|{pu}"
            rounds = int(pg["rounds_played"].sum())
            cl = clutches[(clutches.puuid == pu) & (clutches.team == team)]
            if s != "all":
                cl = cl[cl.match_id.isin(pg.match_id)]
            agents = Counter(agent_name(a) for a in pg["agent_guid"])
            row = {
                "alias": alias_of[pu],
                "matches": int(pg["match_id"].nunique()),
                "rounds": rounds,
                "badge": sample_badge(rounds),
                "agents": [{"agent": a, "matches": c} for a, c in agents.most_common()],
                "kills": int(pg["kills"].sum()),
                "deaths": int(pg["deaths"].sum()),
                "assists": int(pg["assists"].sum()),
                "kpr": round(pg["kills"].sum() / rounds, 3) if rounds else None,
                "dpr": round(pg["deaths"].sum() / rounds, 3) if rounds else None,
                "clutches": int(len(cl)),
                "fk": reg.get(f"{s}.player.fk", unit),
                "fd": reg.get(f"{s}.player.fd", unit),
            }
            if real_names:
                row["real_name"] = real_names.get(pu)
            rows.append(row)
        rows.sort(key=lambda r: -r["rounds"])
        out[s] = rows
    return out


def match_prior(ctx: Context):
    m = ctx.matches
    pairs = []
    for t in ctx.teams:
        mine = m[(m.team_a == t) | (m.team_b == t)]
        pairs.append((int((mine.winner == t).sum()), len(mine)))
    return fit_beta_prior(pairs)


def veto_league(ctx: Context) -> dict:
    tr = ctx.team_rounds
    out = {"overall": {}, "maps": {}}
    for side in ("atk", "def"):
        t = tr[tr.side == side]
        out["overall"][side] = {"k": int(t.won.sum()), "n": int(len(t)), "rate": round(float(t.won.mean()), 4)}
    for mp, g in tr.groupby("map"):
        d = {"matches": int(g.match_id.nunique())}
        for side in ("atk", "def"):
            t = g[g.side == side]
            d[side] = {"k": int(t.won.sum()), "n": int(len(t)), "rate": round(float(t.won.mean()), 4)}
        out["maps"][mp] = d
    return out


def veto_team(ctx: Context, team: str, reg: PropRegistry) -> dict:
    tr = ctx.team_rounds[ctx.team_rounds.team == team]
    out = {"overall": {s: reg.get(f"all.{s}.win", team) for s in ("atk", "def")}, "maps": {}}
    for mp, g in tr.groupby("map"):
        d = {"matches": int(g.match_id.nunique())}
        for side in ("atk", "def"):
            t = g[g.side == side]
            d[side] = {"k": int(t.won.sum()), "n": int(len(t))}
        out["maps"][mp] = d
    return out


def team_profile_slices(ctx: Context, team: str, reg: PropRegistry, pct: pd.DataFrame) -> dict:
    tr = ctx.team_rounds
    maps_played = sorted(tr.loc[tr.team == team, "map"].unique())
    out = {}
    for s in ["all"] + maps_played:
        g = lambda mid: reg.get(f"{s}.{mid}", team)  # noqa: E731
        sl = {
            "attack": {
                "win": g("atk.win"),
                "plant_rate": g("atk.plant_rate"),
                "postplant_win": g("atk.postplant_win"),
                "plant_fast": g("atk.plant_fast"),
                "plant_late": g("atk.plant_late"),
                "plant_time": plant_time_profile(ctx, team, s, pct),
            },
            "defense": {
                "win": g("def.win"),
                "no_plant": g("def.no_plant"),
                "retake": g("def.retake"),
            },
            "pistol": {
                "win": g("pistol.win"),
                "atk": g("pistol.atk.win"),
                "def": g("pistol.def.win"),
                "after_win": {b: g(f"pistol.after_win.{b}") for b in BUYS} | {"win": g("pistol.after_win.win")},
                "after_loss": {b: g(f"pistol.after_loss.{b}") for b in BUYS} | {"win": g("pistol.after_loss.win")},
            },
        }
        if s != "all":
            sites = sorted(x.rsplit(".", 1)[-1] for x in reg.metrics() if x.startswith(f"{s}.atk.site."))
            sl["attack"]["sites"] = {x: g(f"atk.site.{x}") for x in sites}
            sl["defense"]["opp_sites"] = {x: g(f"def.opp_site.{x}") for x in sites}
            sl["defense"]["retake_by_site"] = {x: g(f"def.retake.{x}") for x in sites}
        out[s] = sl
    return out
