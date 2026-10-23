"""Cartões de insight (§7.2): regras determinísticas + templates. Nenhum LLM gera números ou textos."""
from __future__ import annotations

from . import config
from .dictionaries import MAP_NAMES
from .registry import PropRegistry
from .stats import is_probable


def pct(x: float | None) -> str:
    if x is None:
        return "—"
    return f"{round(100 * x):d}%"


def prob(x: float) -> str:
    """Probabilidade sem exagero: nunca '100%' nem '0%'."""
    if x > 0.99:
        return ">99%"
    if x < 0.01:
        return "<1%"
    return pct(x)


def mmss(seconds: float | None) -> str:
    if seconds is None:
        return "—"
    s = int(round(seconds))
    return f"{s // 60}:{s % 60:02d}"


def map_label(m: str) -> str:
    return "todos os mapas" if m == "all" else MAP_NAMES.get(m, m.title())


def _card(kind, headline, numbers, stat, evidence, which, strength, scope="all", tone="neutral"):
    ev_count = stat["k"] if which == "yes" else stat["n"] - stat["k"]
    return {
        "id": f"{kind}:{evidence}",
        "kind": kind,
        "headline": headline,
        "numbers": numbers,
        "n": stat["n"],
        "badge": stat["badge"],
        "stat": stat,
        "evidence": evidence,
        "evidence_side": which,
        "evidence_count": ev_count,
        "scope": scope,
        "strength": round(strength, 4),
        "tone": tone,
    }


def _vs_league(reg: PropRegistry, metric: str, team: str):
    st = reg.get(metric, team)
    if not st or st["n"] < config.INSIGHT_MIN_N:
        return None
    p = st["p_gt_league"]
    if not is_probable(p):
        return None
    return st, p, abs(p - 0.5) * 2


def team_insights(reg: PropRegistry, team: str, maps: list[str], plant_profile: dict, player_units: dict[str, str]) -> list[dict]:
    """Gera candidatos e escolhe até INSIGHT_MAX_CARDS. `player_units`: unit -> alias."""
    cands: list[dict] = []

    # Preferência de site por mapa (participação vs. uniforme).
    for m in maps:
        sites = sorted(x.rsplit(".", 1)[-1] for x in reg.metrics() if x.startswith(f"{m}.atk.site."))
        if not sites:
            continue
        uniform = 1 / len(sites)
        for x in sites:
            st = reg.get(f"{m}.atk.site.{x}", team)
            if not st or st["n"] < config.INSIGHT_MIN_N:
                continue
            ratio = st["raw"] / uniform
            if ratio >= config.INSIGHT_SHARE_RATIO:
                cands.append(_card(
                    "site_pref",
                    f"Em {map_label(m)}, prefere plantar no {x}",
                    [{"label": "dos plants", "value": pct(st["raw"])},
                     {"label": "liga", "value": pct(st["league"])},
                     {"label": "se fosse uniforme", "value": pct(uniform)}],
                    st, f"{m}.atk.site.{x}", "yes", min(1.0, (ratio - 1)), scope=m))

    # Ritmo do plant (participação no terço rápido/lento da liga vs. 1/3).
    pt = plant_profile.get("all", {})
    for kind, metric, label in (("plant_fast", "all.atk.plant_fast", "rápido"), ("plant_late", "all.atk.plant_late", "lento")):
        st = reg.get(metric, team)
        if not st or st["n"] < config.INSIGHT_MIN_N:
            continue
        ratio = st["raw"] / (1 / 3)
        if ratio >= config.INSIGHT_SHARE_RATIO:
            head = (f"Ataque {label}: plant com mediana de {mmss(pt.get('median'))}"
                    if pt.get("median") is not None else f"Ataque {label}")
            cands.append(_card(
                kind, head,
                [{"label": f"dos plants no terço mais {label} da liga", "value": pct(st["raw"])},
                 {"label": "esperado", "value": "33%"},
                 {"label": "IQR do tempo", "value": f"{mmss(pt.get('q1'))}–{mmss(pt.get('q3'))}"}],
                st, metric, "yes", min(1.0, ratio - 1)))

    # Comparações com a liga (diferença provável > 90%).
    vs = [
        ("atk_win", "all.atk.win", "Vence mais rounds de ataque que a média da liga", "Vence menos rounds de ataque que a média da liga", "rounds de ataque vencidos"),
        ("def_win", "all.def.win", "Defesa acima da média da liga", "Defesa abaixo da média da liga", "rounds de defesa vencidos"),
        ("postplant", "all.atk.postplant_win", "Converte bem depois de plantar", "Converte pouco depois de plantar", "rounds vencidos após o plant"),
        ("plant_rate", "all.atk.plant_rate", "Planta a spike com frequência", "Planta a spike com pouca frequência", "rounds de ataque com plant"),
        ("no_plant", "all.def.no_plant", "Defesa nega o plant com frequência", "Adversários plantam com facilidade contra este time", "rounds de defesa sem plant adversário"),
        ("retake", "all.def.retake", "Recupera bem rounds com spike plantada", "Recupera poucos rounds com spike plantada", "retakes bem-sucedidos"),
        ("pistol", "all.pistol.win", "Forte nos pistols", "Pistols abaixo da média da liga", "pistols vencidos"),
        ("eco_after_pistol", "all.pistol.after_loss.eco", "Depois de perder o pistol, compra eco em {v} das vezes", "Depois de perder o pistol, raramente faz eco ({v})", "rounds 1/13 com eco após perder o pistol"),
        ("force_down3", "all.econ.down3.force", "Perdendo por 3 ou mais, faz force em {v} das vezes", "Perdendo por 3 ou mais, raramente faz force ({v})", "rounds com force estando 3+ atrás"),
        ("antieco", "all.econ.antieco_win", "Converte bem os anti-ecos", "Perde mais anti-ecos que a média da liga", "rounds com full contra eco vencidos"),
    ]
    for kind, metric, hi, lo, label in vs:
        res = _vs_league(reg, metric, team)
        if not res:
            continue
        st, p, strength = res
        up = p > 0.5
        head = (hi if up else lo).format(v=pct(st["raw"]))
        cands.append(_card(
            kind, head,
            [{"label": label, "value": pct(st["raw"])},
             {"label": "liga", "value": pct(st["league"])},
             {"label": "P(acima da liga)" if up else "P(abaixo da liga)", "value": prob(p if up else 1 - p)}],
            st, metric, "yes" if up else "no", strength, tone="positive" if up else "alert"))

    # Retake por mapa/site.
    for m in maps:
        for metric in [x for x in reg.metrics() if x.startswith(f"{m}.def.retake.")]:
            res = _vs_league(reg, metric, team)
            if not res:
                continue
            st, p, strength = res
            x = metric.rsplit(".", 1)[-1]
            up = p > 0.5
            head = (f"Em {map_label(m)}, segura bem o pós-plant no {x}" if up
                    else f"Em {map_label(m)}, perde a maioria dos pós-plants no {x}")
            cands.append(_card(
                "retake_site", head,
                [{"label": "rounds vencidos com spike no site", "value": pct(st["raw"])},
                 {"label": "liga", "value": pct(st["league"])}],
                st, metric, "yes" if up else "no", strength * 0.9, scope=m, tone="positive" if up else "alert"))

    # Jogadores que abrem o round.
    for unit, alias in player_units.items():
        for kind, metric, hi in (("player_fk", "all.player.fk", "{a} costuma abrir o round: primeiro abate em {v} dos rounds"),
                                 ("player_fd", "all.player.fd", "{a} é a primeira baixa do round em {v} dos rounds")):
            res = _vs_league(reg, metric, unit)
            if not res:
                continue
            st, p, strength = res
            if p < 0.5:
                continue
            cands.append(_card(
                kind, hi.format(a=alias, v=pct(st["raw"])),
                [{"label": "dos rounds", "value": pct(st["raw"])},
                 {"label": "média de jogadores da liga", "value": pct(st["league"])}],
                st, f"{metric}|{alias}", "yes", strength * 0.85))

    # Seleção: ok antes de confiança baixa; mais forte primeiro; no máx. 2 por tipo.
    rank = {"ok": 0, "low": 1, "insufficient": 2}
    cands.sort(key=lambda c: (rank[c["badge"]], -c["strength"]))
    picked, per_group = [], {}
    for c in cands:
        group = "player" if c["kind"].startswith("player_") else c["kind"]
        if per_group.get(group, 0) >= 2:
            continue
        picked.append(c)
        per_group[group] = per_group.get(group, 0) + 1
        if len(picked) >= config.INSIGHT_MAX_CARDS:
            break
    return picked
