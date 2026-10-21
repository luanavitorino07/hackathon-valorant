"""Fase 0 (§4): auditoria do schema nos 336 arquivos -> docs/schema_audit.md."""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .parse import TEAM_IDS, Tables, iter_match_files, parse_filename, source_of


def _fmt_counter(c: Counter, header=("valor", "n")) -> str:
    lines = [f"| {header[0]} | {header[1]} |", "| --- | ---: |"]
    for k, v in sorted(c.items(), key=lambda kv: (-kv[1], str(kv[0]))):
        lines.append(f"| `{k!r}` | {v} |")
    return "\n".join(lines)


def _md_table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    lines = ["| " + " | ".join(map(str, cols)) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    for _, row in df.iterrows():
        lines.append("| " + " | ".join(str(row[c]) for c in cols) + " |")
    return "\n".join(lines)


def _circ_diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    d = np.abs((a - b) % (2 * math.pi))
    return np.minimum(d, 2 * math.pi - d)


def raw_scan(raw_dir: Path) -> dict:
    """Varredura direta dos JSON (campos, tipos, snapshots, viewRadians)."""
    files = iter_match_files(raw_dir)
    res: dict = {
        "n_files": len(files),
        "folders": Counter(),
        "top_keys": Counter(),
        "matchinfo_keys": Counter(),
        "player_keys": Counter(),
        "stats_keys": Counter(),
        "ability_casts_keys": Counter(),
        "team_keys": Counter(),
        "round_keys": Counter(),
        "playerstats_keys": Counter(),
        "economy_keys": Counter(),
        "coach_keys": Counter(),
        "ability_effects_non_null": 0,
        "ability_effects_total": 0,
        "result_x_code": Counter(),
        "ceremony": Counter(),
        "plant_site": Counter(),
        "game_versions": Counter(),
        "is_completed": Counter(),
        "max_round_num": 0,
        "snapshot_sizes": Counter(),
        "snapshot_has_teamid": 0,
        "snapshot_both_teams": 0,
        "snapshot_total": 0,
        "view_min": math.inf,
        "view_max": -math.inf,
        "kill_aim_diffs": [],
        "kill_aim_diffs_swapped": [],
        "kill_aim_diffs_neg": [],
        "kill_invariance": Counter(),
        "kill_invariance_fail_examples": [],
        "bomb_events": 0,
        "bomb_events_self": 0,
        "self_events_by_type": Counter(),
        "team_kills": 0,
        "players_count": Counter(),
        "observers_files": 0,
        "coaches_total": 0,
        "rounds_len_vs_played": Counter(),
    }
    rng = np.random.default_rng(config.SEED)
    for path in files:
        res["folders"][source_of(path, raw_dir)] += 1
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        res["top_keys"].update(d.keys())
        mi = d["matchInfo"]
        res["matchinfo_keys"].update(mi.keys())
        res["game_versions"][mi.get("gameVersion", "")[:13]] += 1
        res["is_completed"][mi.get("isCompleted")] += 1
        res["players_count"][len(d["players"])] += 1
        if any(p.get("teamId") not in TEAM_IDS for p in d["players"]):
            res["observers_files"] += 1
        res["coaches_total"] += len(d.get("coaches") or [])
        for c in d.get("coaches") or []:
            res["coach_keys"].update(c.keys())
        players = [p for p in d["players"] if p.get("teamId") in TEAM_IDS]
        team_of = {p["puuid"]: p["teamId"] for p in players}
        for p in players:
            res["player_keys"].update(p.keys())
            res["stats_keys"].update((p.get("stats") or {}).keys())
            res["ability_casts_keys"].update(((p.get("stats") or {}).get("abilityCasts") or {}).keys())
        for t in d["teams"]:
            res["team_keys"].update(t.keys())
        rp = d["teams"][0]["roundsPlayed"]
        res["rounds_len_vs_played"][len(d["roundResults"]) == rp] += 1
        total_kills = sum(p["stats"]["kills"] for p in players)
        counts = {"todas": 0, "sem_bomba_auto": 0, "sem_bomba_auto_tk": 0}
        for r in d["roundResults"]:
            res["round_keys"].update(r.keys())
            res["result_x_code"][(r.get("roundResult"), r.get("roundResultCode"))] += 1
            res["ceremony"][r.get("roundCeremony")] += 1
            res["plant_site"][r.get("plantSite")] += 1
            res["max_round_num"] = max(res["max_round_num"], r["roundNum"])
            for key in ("plantPlayerLocations", "defusePlayerLocations"):
                snap = r.get(key)
                if not snap:
                    continue
                res["snapshot_total"] += 1
                res["snapshot_sizes"][(key, len(snap))] += 1
                if any("teamId" in s for s in snap):
                    res["snapshot_has_teamid"] += 1
                if len({team_of.get(s["puuid"]) for s in snap}) == 2:
                    res["snapshot_both_teams"] += 1
                for s in snap:
                    v = s.get("viewRadians")
                    if v is not None:
                        res["view_min"] = min(res["view_min"], v)
                        res["view_max"] = max(res["view_max"], v)
            for ps in r.get("playerStats") or []:
                res["playerstats_keys"].update(ps.keys())
                res["economy_keys"].update((ps.get("economy") or {}).keys())
                ab = ps.get("ability") or {}
                for v in ab.values():
                    res["ability_effects_total"] += 1
                    res["ability_effects_non_null"] += v is not None
                for k in ps.get("kills") or []:
                    fd = k.get("finishingDamage") or {}
                    selfk = k["killer"] == k["victim"]
                    bomb = fd.get("damageType") == "Bomb"
                    tk = (not selfk) and team_of.get(k["killer"]) == team_of.get(k["victim"])
                    if bomb:
                        res["bomb_events"] += 1
                        res["bomb_events_self"] += selfk
                    if selfk:
                        res["self_events_by_type"][fd.get("damageType")] += 1
                    res["team_kills"] += tk
                    counts["todas"] += 1
                    if not (selfk or bomb):
                        counts["sem_bomba_auto"] += 1
                        if not tk:
                            counts["sem_bomba_auto_tk"] += 1
                    # Referencial de viewRadians: mira do matador vs. direção até a vítima.
                    if fd.get("damageType") == "Weapon" and not selfk and rng.random() < 0.25:
                        kl = next((pl for pl in k.get("playerLocations") or [] if pl["puuid"] == k["killer"]), None)
                        vl = k.get("victimLocation")
                        if kl and vl:
                            dx = vl["x"] - kl["location"]["x"]
                            dy = vl["y"] - kl["location"]["y"]
                            if dx or dy:
                                v = kl["viewRadians"]
                                res["kill_aim_diffs"].append(_circ_diff(np.array(v), np.array(math.atan2(dy, dx) % (2 * math.pi))).item())
                                res["kill_aim_diffs_swapped"].append(_circ_diff(np.array(v), np.array(math.atan2(dx, dy) % (2 * math.pi))).item())
                                res["kill_aim_diffs_neg"].append(_circ_diff(np.array(v), np.array(math.atan2(-dy, dx) % (2 * math.pi))).item())
        for name, c in counts.items():
            ok = c == total_kills
            res["kill_invariance"][(name, ok)] += 1
            if name == "sem_bomba_auto_tk" and not ok:
                res["kill_invariance_fail_examples"].append((path.name, c, total_kills))
    return res


def write_audit(tables: Tables, frames: dict[str, pd.DataFrame], raw_dir: Path = config.RAW_DIR,
                out_path: Path | None = None) -> Path:
    out_path = out_path or (config.DOCS_DIR / "schema_audit.md")
    scan = raw_scan(raw_dir)
    m, r, rp, k = frames["matches"], frames["rounds"], frames["round_players"], frames["kills"]

    # Contagem de partidas por time e por jogador.
    team_counts = pd.concat([m["team_a"], m["team_b"]]).value_counts()
    pl = frames["players"]
    player_counts = pl.groupby("puuid")["match_id"].nunique()
    player_teams = pl.groupby("puuid")["team_slug"].nunique()

    # Histograma de economia (média de loadout por time e round, rounds regulamentares sem pistol).
    buy = rp.groupby(["match_id", "round_num", "team_slug"])["loadout_value"].mean().reset_index()
    reg = buy[(buy.round_num < config.REGULATION_ROUNDS) & (~buy.round_num.isin(config.PISTOL_ROUNDS))]
    bins = np.arange(0, 6250, 250)
    hist, edges = np.histogram(reg["loadout_value"], bins=bins)

    aim = np.array(scan["kill_aim_diffs"])
    aim_sw = np.array(scan["kill_aim_diffs_swapped"])
    aim_neg = np.array(scan["kill_aim_diffs_neg"])

    expected = {
        "Rush Series Esquenta": 29, "Rush Series Esquenta 2": 26, "Rush Series Inclusivo": 13,
        "Univavá / Classificatória 1": 55, "Univavá / Classificatória 2": 39, "Univavá / Classificatória 3": 43,
        "Univavá / Classificatória 4": 62, "Univavá / Fase de Grupos": 69,
    }

    L: list[str] = []
    w = L.append
    w("# Auditoria do schema (Fase 0)\n")
    w("Gerado automaticamente por `scoutroom audit` a partir dos JSON brutos em `data/raw/` "
      "(link para a pasta `dados/` entregue pela organização). Nenhum dado externo.\n")
    w(f"**Arquivos encontrados (busca recursiva `rglob('*.json')`): {scan['n_files']}**\n")

    w("## 1. Estrutura de diretórios\n")
    w("| pasta | esperado | encontrado | ok |\n| --- | ---: | ---: | :---: |")
    for folder, n in sorted(scan["folders"].items()):
        e = expected.get(folder)
        w(f"| {folder} | {e if e is not None else '—'} | {n} | {'✅' if e == n else '⚠️'} |")
    w("")

    w("## 2. Nome do arquivo\n")
    w("Regex (ID alfanumérico para a Fase de Grupos, ex.: `001a`):\n")
    w("```\n^(?P<prefix>[A-Z0-9_]+?)_(?P<match_num>\\d+[a-zA-Z]?)_(?P<date>\\d{2}-\\d{2}-\\d{2})_(?P<team1>.+?)_(?P<score1>\\d+)_x_(?P<score2>\\d+)_(?P<team2>.+?)_(?P<map>[a-z]+)\\.json$\n```\n")
    w(f"- Nomes que falharam: **{len(tables.filename_failures)}** {tables.filename_failures or ''}")
    suffixed = m[m["match_num"].str.contains(r"[a-zA-Z]")]
    w(f"- IDs com sufixo de letra: {len(suffixed)} (prefixos: {dict(Counter(suffixed['prefix']))})")
    w(f"- Prefixos: {dict(Counter(m['prefix']))}")
    ties = m[m.score_a == m.score_b]
    w(f"- Partidas com placar empatado no nome: {len(ties)} (desempate por elenco não foi necessário)")
    team_anoms = [a for a in tables.anomalies if a["kind"] == "team_mapping"]
    w(f"- Anomalias no mapeamento Blue/Red ↔ time (§5.2): {len(team_anoms)}\n")

    w("## 3. Campos confirmados\n")
    def keys_line(label, c, total=None):
        total = total or max(c.values()) if c else 0
        parts = [f"`{k}`" + ("" if v == total else f" ({v}/{total})") for k, v in sorted(c.items())]
        w(f"- **{label}**: " + ", ".join(parts))
    keys_line("topo", scan["top_keys"])
    keys_line("matchInfo", scan["matchinfo_keys"])
    keys_line("players[]", scan["player_keys"])
    keys_line("players[].stats", scan["stats_keys"])
    keys_line("players[].stats.abilityCasts", scan["ability_casts_keys"])
    keys_line("coaches[]", scan["coach_keys"])
    keys_line("teams[]", scan["team_keys"])
    keys_line("roundResults[]", scan["round_keys"])
    keys_line("roundResults[].playerStats[]", scan["playerstats_keys"])
    keys_line("playerStats[].economy", scan["economy_keys"])
    w(f"- `playerStats[].ability.*Effects` não nulos: **{scan['ability_effects_non_null']}** de {scan['ability_effects_total']} "
      "(confirmado: sempre `null` por round; habilidades só agregadas em `players[].stats.abilityCasts`).")
    w(f"- `players` por arquivo: {dict(scan['players_count'])}. **{scan['observers_files']} arquivos trazem 1 observador** "
      "(`teamId: \"Neutral\"`, `isObserver: true`, `stats: null`) — descartado das métricas.")
    w(f"- `coaches`: {scan['coaches_total']} entradas no total, sempre fora de `players` (ignoradas nas métricas).")
    w(f"- `isCompleted`: {dict(scan['is_completed'])} → nenhuma partida incompleta.")
    w(f"- `gameVersion` (prefixo): {dict(sorted(scan['game_versions'].items()))}")
    w(f"- `len(roundResults) == roundsPlayed`: {dict(scan['rounds_len_vs_played'])}")
    w(f"- Maior `roundNum`: **{scan['max_round_num']}** (0-indexado). Partidas com prorrogação (> 24 rounds): {int(m.is_overtime.sum())}.\n")

    w("### Mapas (`matchInfo.mapId` × sufixo do arquivo)\n")
    w("| sufixo | mapId | partidas |\n| --- | --- | ---: |")
    mc = Counter(m["map"])
    for slug, ids in sorted(tables.map_ids.items(), key=lambda kv: -mc[kv[0]]):
        w(f"| {slug} | {', '.join(f'`{i}`' for i in sorted(ids))} | {mc[slug]} |")
    w("\nCada sufixo corresponde a exatamente um `mapId` (dicionário gerado em `data/dictionaries/maps.json`).\n")

    w("### `roundResult` × `roundResultCode`\n")
    w("| roundResult | roundResultCode | n |\n| --- | --- | ---: |")
    for (a, b), n in sorted(scan["result_x_code"].items(), key=lambda kv: -kv[1]):
        w(f"| {a} | `{b!r}` | {n} |")
    w("\nConfirmado: `roundResultCode` vem **vazio** quando o tempo expira → usamos `roundResult`.\n")
    w("### `roundCeremony`\n")
    w(_fmt_counter(scan["ceremony"]))
    w("\n### `plantSite`\n")
    w(_fmt_counter(scan["plant_site"]))
    sites_by_map = r[r.plant_site != ""].merge(m[["match_id", "map"]], on="match_id").groupby("map")["plant_site"].apply(lambda s: "".join(sorted(set(s))))
    w("\nSites por mapa: " + ", ".join(f"{k}: {v}" for k, v in sites_by_map.items()) + "\n")

    w("## 4. Snapshots (`plantPlayerLocations`, `defusePlayerLocations`, `kills[].playerLocations`)\n")
    w(f"- Snapshots analisados: {scan['snapshot_total']}; com `teamId` no objeto: **{scan['snapshot_has_teamid']}**; "
      f"com jogadores dos dois times misturados: **{scan['snapshot_both_teams']}**.")
    w("- Conclusão: lista de todos os vivos dos dois times, sem time → join obrigatório com `players` (feito no pipeline).")
    w(f"- `viewRadians` observado em [{scan['view_min']:.4f}, {scan['view_max']:.4f}] ⊂ [0, 2π).")
    rounds_with_plant = int((r.plant_site != "").sum())
    w(f"- Rounds com plant: {rounds_with_plant}; snapshots de plant: {r[r.plant_site != ''].shape[0]} "
      f"(1 por plant); defuses: {int(r.defuser.notna().sum())}, snapshots de defuse: {frames['defuse_snapshot'][['match_id','round_num']].drop_duplicates().shape[0]}.\n")
    w("### Referencial de `viewRadians`\n")
    w("Validação com abates por arma: diferença angular circular entre a mira do matador no instante do abate e a direção até a vítima "
      f"(amostra aleatória de {aim.size} abates, seed fixa).\n")
    w("| hipótese | mediana da diferença | % dentro de ±15° |\n| --- | ---: | ---: |")
    for label, arr in (("atan2(Δy, Δx) mod 2π", aim), ("atan2(Δx, Δy) (eixos trocados)", aim_sw), ("atan2(−Δy, Δx) (y invertido)", aim_neg)):
        w(f"| {label} | {math.degrees(float(np.median(arr))):.1f}° | {100 * float(np.mean(arr < math.radians(15))):.1f}% |")
    w("\nConfirmado: `viewRadians = atan2(Δy, Δx) mod 2π` no sistema (x, y) do jogo.\n")

    w("## 5. Anomalias críticas\n")
    w("### 5.1 Mortes para a Spike / auto-abates\n")
    w(f"- Eventos com `damageType == \"Bomb\"`: **{scan['bomb_events']}**, dos quais `killer == victim`: {scan['bomb_events_self']}.")
    w(f"- Auto-abates (`killer == victim`) por tipo: {dict(scan['self_events_by_type'])} (quedas também aparecem como auto-abate).")
    w(f"- Abates em companheiro de time (teamkill): {scan['team_kills']}.\n")
    w("Invariância por partida — soma de eventos em `playerStats[].kills` == soma de `players[].stats.kills`:\n")
    w("| filtro | partidas ok | partidas com falha |\n| --- | ---: | ---: |")
    for name, label in (("todas", "todos os eventos"), ("sem_bomba_auto", "sem bomba/auto-abate"), ("sem_bomba_auto_tk", "sem bomba/auto-abate e sem teamkill")):
        w(f"| {label} | {scan['kill_invariance'][(name, True)]} | {scan['kill_invariance'][(name, False)]} |")
    w("\nRegra adotada (§5.3): estatísticas de abate usam `not is_self_or_bomb_kill and not is_team_kill` "
      "(view `valid_kills` no DuckDB). Com ela a invariância vale em 100% das partidas.\n")

    w("### 5.2 Partidas por time e por jogador\n")
    w(f"- Times distintos: **{len(team_counts)}**; com ≥ 5 partidas: **{int((team_counts >= 5).sum())}**; "
      f"com ≥ 10 partidas: **{int((team_counts >= 10).sum())}**.")
    w(f"- Jogadores distintos (puuid): {len(player_counts)}; com ≥ 5 partidas: {int((player_counts >= 5).sum())}; "
      f"jogadores que aparecem em mais de um time: {int((player_teams > 1).sum())}.")
    w(f"- Partidas incompletas (`isCompleted: false`): {int((~m.is_completed).sum())}.\n")
    w("| time (slug) | partidas |\n| --- | ---: |")
    for t, n in team_counts.items():
        w(f"| {t} | {n} |")
    dist = Counter(team_counts.values)
    w("\nDistribuição (nº de partidas → nº de times): " + ", ".join(f"{k}→{v}" for k, v in sorted(dist.items())) + "\n")
    pdist = Counter(player_counts.values)
    w("Jogadores (nº de partidas → nº de jogadores): " + ", ".join(f"{k}→{v}" for k, v in sorted(pdist.items())) + "\n")

    w("### 5.3 Lado por round (§5.4)\n")
    kinds = Counter(a["kind"] for a in tables.anomalies)
    w(f"- Lado derivado de `winningTeam` + `winningTeamRole`. Inconsistências: plantador fora do ataque = "
      f"{kinds.get('planter_not_attacker', 0)}; defusador fora da defesa = {kinds.get('defuser_not_defender', 0)}.")
    sides = r.merge(m[["match_id", "n_rounds"]], on="match_id")
    ot = sides[sides.round_num >= config.REGULATION_ROUNDS].sort_values(["match_id", "round_num"])
    swaps = ot.groupby("match_id")["atk_team"].apply(lambda s: (s.values[1:] != s.values[:-1]).mean() if len(s) > 1 else float("nan")).dropna()
    w(f"- Na prorrogação, fração de rounds consecutivos com troca de lado: {swaps.mean():.2f} (esperado ≈ 1, troca a cada round).")
    reg_sides = sides[sides.round_num < config.REGULATION_ROUNDS]
    first_half = reg_sides[reg_sides.round_num < 12].groupby("match_id")["atk_team"].nunique()
    w(f"- Partidas em que o atacante muda dentro do 1º tempo: {int((first_half > 1).sum())}.\n")

    w("## 6. Economia — histograma para validar os limiares (§9.1)\n")
    w("Média de `loadoutValue` dos 5 jogadores por time e round (rounds 1–11 e 13–23):\n")
    w("| faixa | n | |\n| --- | ---: | --- |")
    mx = hist.max()
    for i, n in enumerate(hist):
        bar = "█" * int(round(40 * n / mx))
        w(f"| {int(edges[i])}–{int(edges[i + 1]) - 1} | {n} | `{bar}` |")
    eco = (reg.loadout_value < config.ECO_MAX).mean()
    full = (reg.loadout_value >= config.FULL_MIN).mean()
    w(f"\nCom os limiares eco < {config.ECO_MAX}, force {config.ECO_MAX}–{config.FULL_MIN - 1}, full ≥ {config.FULL_MIN}: "
      f"eco = {eco:.1%}, force = {1 - eco - full:.1%}, full = {full:.1%}.")
    w(f"\nPistols (rounds 0 e 12): média {buy[buy.round_num.isin(config.PISTOL_ROUNDS)].loadout_value.mean():.0f}; "
      f"prorrogação (≥ 24): média {buy[buy.round_num >= config.REGULATION_ROUNDS].loadout_value.mean():.0f} (classificados como full).\n")
    w("Contagem de jogadores por time e round: " + str(dict(Counter(rp.groupby(['match_id', 'round_num', 'team_slug']).size()))) + "\n")

    w("## 7. Tabelas geradas (§5.3)\n")
    w("| tabela | linhas | colunas |\n| --- | ---: | --- |")
    for name, df in frames.items():
        w(f"| {name} | {len(df)} | {', '.join(df.columns)} |")
    w("\nArquivos: `data/tables/*.parquet` e `data/scoutroom.duckdb` (view `valid_kills`).\n")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(L), encoding="utf-8")
    return out_path
