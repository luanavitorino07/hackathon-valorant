"""Leitura dos JSON brutos e construção das tabelas normalizadas (§5)."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pandas as pd

from . import config

FILENAME_RE = re.compile(
    r"^(?P<prefix>[A-Z0-9_]+?)_(?P<match_num>\d+[a-zA-Z]?)_(?P<date>\d{2}-\d{2}-\d{2})_"
    r"(?P<team1>.+?)_(?P<score1>\d+)_x_(?P<score2>\d+)_(?P<team2>.+?)_(?P<map>[a-z]+)\.json$"
)

TEAM_IDS = ("Blue", "Red")


def other(team_id: str) -> str:
    return "Red" if team_id == "Blue" else "Blue"


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")
    return text


@dataclass
class FileName:
    prefix: str
    match_num: str
    date: date
    team1: str
    team2: str
    score1: int
    score2: int
    map: str


def parse_filename(name: str) -> FileName | None:
    m = FILENAME_RE.match(name)
    if not m:
        return None
    dd, mm, yy = (int(x) for x in m["date"].split("-"))
    return FileName(
        prefix=m["prefix"],
        match_num=m["match_num"],
        date=date(2000 + yy, mm, dd),
        team1=slugify(m["team1"]),
        team2=slugify(m["team2"]),
        score1=int(m["score1"]),
        score2=int(m["score2"]),
        map=m["map"],
    )


def iter_match_files(raw_dir: Path = config.RAW_DIR) -> list[Path]:
    return sorted(Path(raw_dir).rglob("*.json"))


def source_of(path: Path, raw_dir: Path) -> str:
    """Torneio/fase a partir das pastas: 'Univavá / Fase de Grupos'."""
    rel = path.resolve().parent.relative_to(Path(raw_dir).resolve())
    return " / ".join(rel.parts) if rel.parts else ""


def patch_of(game_version: str) -> str:
    m = re.match(r"release-(\d+\.\d+)", game_version or "")
    return m.group(1) if m else ""


@dataclass
class Tables:
    matches: list[dict] = field(default_factory=list)
    rounds: list[dict] = field(default_factory=list)
    round_players: list[dict] = field(default_factory=list)
    kills: list[dict] = field(default_factory=list)
    plant_snapshot: list[dict] = field(default_factory=list)
    defuse_snapshot: list[dict] = field(default_factory=list)
    players: list[dict] = field(default_factory=list)
    filename_failures: list[str] = field(default_factory=list)
    anomalies: list[dict] = field(default_factory=list)
    map_ids: dict[str, set] = field(default_factory=lambda: defaultdict(set))
    riot_ids: dict[str, str] = field(default_factory=dict)  # puuid -> gameName#tagLine (só para data/private)

    def frames(self) -> dict[str, pd.DataFrame]:
        return {
            "matches": pd.DataFrame(self.matches),
            "rounds": pd.DataFrame(self.rounds),
            "round_players": pd.DataFrame(self.round_players),
            "kills": pd.DataFrame(self.kills),
            "plant_snapshot": pd.DataFrame(self.plant_snapshot),
            "defuse_snapshot": pd.DataFrame(self.defuse_snapshot),
            "players": pd.DataFrame(self.players),
        }


def _team_mapping(fn: FileName, raw: dict, rosters: dict[str, Counter]) -> tuple[dict[str, str], str | None]:
    """teamId (Blue/Red) -> slug. §5.2: placar do nome do arquivo vs roundsWon."""
    won = {t["teamId"]: t["roundsWon"] for t in raw["teams"]}
    if fn.score1 != fn.score2:
        if won.get("Blue") == fn.score1 and won.get("Red") == fn.score2:
            return {"Blue": fn.team1, "Red": fn.team2}, None
        if won.get("Red") == fn.score1 and won.get("Blue") == fn.score2:
            return {"Red": fn.team1, "Blue": fn.team2}, None
        return {"Blue": fn.team1, "Red": fn.team2}, "placar do arquivo não bate com roundsWon"
    # Empate: cruza puuids com elencos conhecidos.
    pu = {tid: {p["puuid"] for p in raw["players"] if p["teamId"] == tid} for tid in TEAM_IDS}
    score_direct = sum(rosters[fn.team1][p] for p in pu["Blue"]) + sum(rosters[fn.team2][p] for p in pu["Red"])
    score_swap = sum(rosters[fn.team1][p] for p in pu["Red"]) + sum(rosters[fn.team2][p] for p in pu["Blue"])
    if score_direct > score_swap:
        return {"Blue": fn.team1, "Red": fn.team2}, None
    if score_swap > score_direct:
        return {"Red": fn.team1, "Blue": fn.team2}, None
    return {"Blue": fn.team1, "Red": fn.team2}, "placar empatado e elenco ambíguo"


def load_raw(paths: list[Path]) -> list[tuple[Path, FileName | None, dict]]:
    out = []
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            out.append((p, parse_filename(p.name), json.load(fh)))
    return out


def build_tables(raw_dir: Path = config.RAW_DIR) -> Tables:
    tables = Tables()
    loaded = load_raw(iter_match_files(raw_dir))

    # Primeira passada: elencos a partir de partidas sem empate (para desempate do §5.2).
    rosters: dict[str, Counter] = defaultdict(Counter)
    for _, fn, raw in loaded:
        if fn is None or fn.score1 == fn.score2:
            continue
        mapping, _ = _team_mapping(fn, raw, rosters)
        for p in raw["players"]:
            if p["teamId"] in mapping:
                rosters[mapping[p["teamId"]]][p["puuid"]] += 1

    for path, fn, raw in loaded:
        if fn is None:
            tables.filename_failures.append(path.name)
            continue
        _parse_match(path, fn, raw, raw_dir, rosters, tables)
    return tables


def _parse_match(path: Path, fn: FileName, raw: dict, raw_dir: Path, rosters, tables: Tables) -> None:
    info = raw["matchInfo"]
    match_id = info["matchId"]
    tables.map_ids[fn.map].add(info["mapId"])
    mapping, problem = _team_mapping(fn, raw, rosters)
    if problem:
        tables.anomalies.append({"match_id": match_id, "file": path.name, "kind": "team_mapping", "detail": problem})

    # Jogadores de verdade: teamId Blue/Red (observadores vêm como "Neutral" e sem stats).
    players = [p for p in raw["players"] if p.get("teamId") in TEAM_IDS]
    team_of = {p["puuid"]: p["teamId"] for p in players}
    teams = {t["teamId"]: t for t in raw["teams"]}
    rounds_raw = raw["roundResults"]
    n_rounds = len(rounds_raw)

    team_a, team_b = fn.team1, fn.team2
    id_of_slug = {v: k for k, v in mapping.items()}
    score_a = teams[id_of_slug[team_a]]["roundsWon"]
    score_b = teams[id_of_slug[team_b]]["roundsWon"]
    winner = team_a if teams[id_of_slug[team_a]]["won"] else team_b
    tables.matches.append({
        "match_id": match_id,
        "file_name": path.name,
        "source": source_of(path, raw_dir),
        "prefix": fn.prefix,
        "match_num": fn.match_num,
        "date": fn.date.isoformat(),
        "map": fn.map,
        "map_id": info["mapId"],
        "patch": patch_of(info.get("gameVersion", "")),
        "team_a": team_a,
        "team_b": team_b,
        "team_a_id": id_of_slug[team_a],
        "team_b_id": id_of_slug[team_b],
        "score_a": score_a,
        "score_b": score_b,
        "winner": winner,
        "length_ms": info.get("gameLengthMillis"),
        "start_ms": info.get("gameStartMillis"),
        "is_completed": bool(info.get("isCompleted")),
        "n_rounds": n_rounds,
        "rounds_played_teams": teams["Blue"]["roundsPlayed"],
        "is_overtime": n_rounds > config.REGULATION_ROUNDS,
        "n_observers": sum(1 for p in raw["players"] if p.get("teamId") not in TEAM_IDS),
        "n_coaches": len(raw.get("coaches") or []),
    })

    for p in players:
        tables.riot_ids[p["puuid"]] = f"{p.get('gameName', '')}#{p.get('tagLine', '')}"
        s = p.get("stats") or {}
        ac = s.get("abilityCasts") or {}
        tables.players.append({
            "match_id": match_id,
            "puuid": p["puuid"],
            "team_id": p["teamId"],
            "team_slug": mapping[p["teamId"]],
            "agent_guid": (p.get("characterId") or "").lower(),
            "kills": s.get("kills", 0),
            "deaths": s.get("deaths", 0),
            "assists": s.get("assists", 0),
            "score": s.get("score", 0),
            "rounds_played": s.get("roundsPlayed", 0),
            "grenade_casts": ac.get("grenadeCasts", 0),
            "ability1_casts": ac.get("ability1Casts", 0),
            "ability2_casts": ac.get("ability2Casts", 0),
            "ultimate_casts": ac.get("ultimateCasts", 0),
        })

    for r in rounds_raw:
        rn = r["roundNum"]
        win_id = r["winningTeam"]
        win_role = r["winningTeamRole"]
        atk_id = win_id if win_role == "Attacker" else other(win_id)
        def_id = other(atk_id)
        planter, defuser = r.get("bombPlanter"), r.get("bombDefuser")
        if planter and team_of.get(planter) != atk_id:
            tables.anomalies.append({"match_id": match_id, "file": path.name, "kind": "planter_not_attacker", "detail": f"round {rn}"})
        if defuser and team_of.get(defuser) != def_id:
            tables.anomalies.append({"match_id": match_id, "file": path.name, "kind": "defuser_not_defender", "detail": f"round {rn}"})
        site = r.get("plantSite") or ""
        pl = r.get("plantLocation") or {}
        dl = r.get("defuseLocation") or {}
        planted = site != ""
        defused = bool(defuser)
        tables.rounds.append({
            "match_id": match_id,
            "round_num": rn,
            "winning_team_id": win_id,
            "winning_team": mapping[win_id],
            "winning_role": win_role,
            "result": r.get("roundResult"),
            "result_code": r.get("roundResultCode"),
            "ceremony": r.get("roundCeremony"),
            "plant_site": site,
            "plant_time_ms": r.get("plantRoundTime") if planted else None,
            "defuse_time_ms": r.get("defuseRoundTime") if defused else None,
            "plant_x": pl.get("x") if planted else None,
            "plant_y": pl.get("y") if planted else None,
            "defuse_x": dl.get("x") if defused else None,
            "defuse_y": dl.get("y") if defused else None,
            "planter": planter,
            "defuser": defuser,
            "atk_team_id": atk_id,
            "def_team_id": def_id,
            "atk_team": mapping[atk_id],
            "def_team": mapping[def_id],
        })

        econ_of: dict[str, dict] = {}
        for ps in r.get("playerStats") or []:
            pu = ps["puuid"]
            tid = team_of.get(pu)
            if tid is None:
                continue
            e = ps.get("economy") or {}
            econ_of[pu] = e
            tables.round_players.append({
                "match_id": match_id,
                "round_num": rn,
                "puuid": pu,
                "team_id": tid,
                "team_slug": mapping[tid],
                "role": "atk" if tid == atk_id else "def",
                "loadout_value": e.get("loadoutValue", 0),
                "spent": e.get("spent", 0),
                "remaining": e.get("remaining", 0),
                "weapon_guid": (e.get("weapon") or "").upper(),
                "armor_guid": (e.get("armor") or "").upper(),
                "round_kills_raw": len(ps.get("kills") or []),
                "round_damage": sum(d.get("damage", 0) for d in ps.get("damage") or []),
                "round_score": ps.get("score", 0),
            })
            for k in ps.get("kills") or []:
                killer, victim = k.get("killer"), k.get("victim")
                fd = k.get("finishingDamage") or {}
                kt, vt = team_of.get(killer), team_of.get(victim)
                vl = k.get("victimLocation") or {}
                tables.kills.append({
                    "match_id": match_id,
                    "round_num": rn,
                    "t_ms": k.get("timeSinceRoundStartMillis"),
                    "t_game_ms": k.get("timeSinceGameStartMillis"),
                    "killer": killer,
                    "killer_team": mapping.get(kt) if kt else None,
                    "victim": victim,
                    "victim_team": mapping.get(vt) if vt else None,
                    "victim_x": vl.get("x"),
                    "victim_y": vl.get("y"),
                    "damage_type": fd.get("damageType"),
                    "damage_item": (fd.get("damageItem") or ""),
                    "is_self_or_bomb_kill": killer == victim or fd.get("damageType") == "Bomb",
                    "is_team_kill": kt is not None and kt == vt and killer != victim,
                })

        for key, target in (("plantPlayerLocations", tables.plant_snapshot), ("defusePlayerLocations", tables.defuse_snapshot)):
            snap = r.get(key)
            if not snap:
                continue
            for loc in snap:
                pu = loc.get("puuid")
                tid = team_of.get(pu)
                if tid is None:
                    continue
                xy = loc.get("location") or {}
                target.append({
                    "match_id": match_id,
                    "round_num": rn,
                    "puuid": pu,
                    "team_id": tid,
                    "team_slug": mapping[tid],
                    "role": "atk" if tid == atk_id else "def",
                    "x": xy.get("x"),
                    "y": xy.get("y"),
                    "view_rad": loc.get("viewRadians"),
                    "spent": (econ_of.get(pu) or {}).get("spent"),
                })
