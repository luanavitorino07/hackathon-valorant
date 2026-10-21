"""Arquivos golden de 3 times para detectar regressões. Atualize com UPDATE_GOLDEN=1 pytest."""
import json
import os
from pathlib import Path

import pytest

from scoutroom.export import build_all

from conftest import requires_raw

pytestmark = requires_raw
GOLDEN = Path(__file__).parent / "golden"
TEAMS = ["ufmt_turuna", "azure_bears_black", "ceub_octopus_vulgaris"]


def fingerprint(team_json: dict) -> dict:
    prof = team_json["profile"]["all"]

    def kn(d):
        return None if d is None else [d["k"], d["n"], d["mean"]]

    return {
        "record": team_json["record"]["all"],
        "insights": [[c["kind"], c["headline"], c["n"]] for c in team_json["insights"]],
        "attack": {k: kn(v) for k, v in prof["attack"].items() if k != "plant_time"},
        "plant_time": prof["attack"]["plant_time"],
        "defense": {k: kn(v) for k, v in prof["defense"].items()},
        "pistol_win": kn(prof["pistol"]["win"]),
        "veto_maps": team_json["veto"]["maps"],
        "n_plants": len(team_json["postplant"]["plants"]),
        "n_review": len(team_json["economy"]["review"]),
        "n_anti_eco_losses": len(team_json["economy"]["anti_eco_losses"]),
        "players": [[p["matches"], p["rounds"], p["kills"], p["clutches"]] for p in team_json["players"]["all"]],
    }


@pytest.fixture(scope="module")
def exported(frames, tables, tmp_path_factory):
    out = tmp_path_factory.mktemp("web_data")
    build_all(frames, tables.riot_ids, out_dir=out, teams_filter=TEAMS)
    return out


@pytest.mark.parametrize("team", TEAMS)
def test_golden(team, exported):
    data = json.loads((exported / "teams" / f"{team}.json").read_text(encoding="utf-8"))
    fp = json.loads(json.dumps(fingerprint(data)))
    path = GOLDEN / f"{team}.json"
    if os.environ.get("UPDATE_GOLDEN") or not path.exists():
        GOLDEN.mkdir(exist_ok=True)
        path.write_text(json.dumps(fp, ensure_ascii=False, indent=1), encoding="utf-8")
        pytest.skip("golden gerado")
    assert fp == json.loads(path.read_text(encoding="utf-8"))


def test_team_json_size_limit(exported):
    import gzip
    for f in (exported / "teams").glob("*.json"):
        assert len(gzip.compress(f.read_bytes())) < 1_000_000, f


def test_seeds_reproduce(frames, tables, tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    build_all(frames, tables.riot_ids, out_dir=a, teams_filter=TEAMS[:1])
    build_all(frames, tables.riot_ids, out_dir=b, teams_filter=TEAMS[:1])
    ja = json.loads((a / "teams" / f"{TEAMS[0]}.json").read_text())
    jb = json.loads((b / "teams" / f"{TEAMS[0]}.json").read_text())
    ja.pop("generated_at"); jb.pop("generated_at")
    assert ja == jb
