"""Invariâncias por partida (§11)."""
import json

import pandas as pd

from scoutroom import config
from scoutroom.derive import build_context

from conftest import requires_raw

pytestmark = requires_raw


def test_rounds_len_equals_rounds_played(frames):
    m = frames["matches"]
    assert (m["n_rounds"] == m["rounds_played_teams"]).all()


def test_valid_kills_match_player_stats(frames):
    k = frames["kills"]
    vk = k[~k.is_self_or_bomb_kill & ~k.is_team_kill]
    per_match = vk.groupby("match_id").size()
    stats = frames["players"].groupby("match_id")["kills"].sum()
    joined = pd.concat([per_match.rename("events"), stats.rename("stats")], axis=1).fillna(0)
    bad = joined[joined.events != joined.stats]
    assert bad.empty, bad.head()


def test_bomb_kills_are_flagged(frames):
    k = frames["kills"]
    bomb = k[k.damage_type == "Bomb"]
    assert len(bomb) > 0
    assert bomb.is_self_or_bomb_kill.all()


def test_planter_is_attacker_and_defuser_is_defender(frames, tables):
    assert not [a for a in tables.anomalies if a["kind"] in ("planter_not_attacker", "defuser_not_defender")]
    r = frames["rounds"]
    p = frames["players"][["match_id", "puuid", "team_id"]]
    planted = r[r.planter.notna()].merge(p, left_on=["match_id", "planter"], right_on=["match_id", "puuid"])
    assert (planted.team_id == planted.atk_team_id).all()
    defused = r[r.defuser.notna()].merge(p, left_on=["match_id", "defuser"], right_on=["match_id", "puuid"])
    assert (defused.team_id == defused.def_team_id).all()


def test_plant_site_domain(frames):
    assert set(frames["rounds"].plant_site.unique()) <= {"A", "B", "C", ""}


def test_buy_types_cover_all_rounds(frames):
    ctx = build_context(frames)
    tr = ctx.team_rounds
    assert len(tr) == 2 * len(frames["rounds"])
    assert tr.buy.isin(["pistol", "eco", "force", "full"]).all()
    assert tr.opp_buy.notna().all()
    assert (tr.loc[tr.round_num.isin(config.PISTOL_ROUNDS), "buy"] == "pistol").all()
    assert (tr.loc[tr.round_num >= config.REGULATION_ROUNDS, "buy"] == "full").all()


def test_each_round_has_one_attacker_and_one_defender(frames):
    r = frames["rounds"]
    assert (r.atk_team != r.def_team).all()
    assert (r.atk_team_id != r.def_team_id).all()


def test_snapshot_roles_joined(frames):
    s = frames["plant_snapshot"]
    assert s.role.isin(["atk", "def"]).all()
    assert s.team_slug.notna().all()


def test_no_puuid_in_web_output():
    out = config.WEB_DATA_DIR
    if not out.exists():
        return
    puuids = set(pd.read_parquet(config.TABLES_DIR / "players.parquet")["puuid"]) if (config.TABLES_DIR / "players.parquet").exists() else set()
    sample = list(puuids)[:50]
    for f in list(out.rglob("*.json"))[:200]:
        text = f.read_text(encoding="utf-8")
        assert not any(p in text for p in sample), f"PUUID vazou em {f}"
        assert "gameName" not in text and "#" not in json.dumps(json.loads(text).get("real_name", "")), f
