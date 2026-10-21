from scoutroom.parse import parse_filename, slugify

from conftest import requires_raw


def test_regex_group_stage_suffix():
    fn = parse_filename("UNIVAVA_G_013c_19-09-26_azure_bears_golden_13_x_7_ceub_octopus_vulgaris_abyss.json")
    assert fn is not None
    assert fn.prefix == "UNIVAVA_G"
    assert fn.match_num == "013c"
    assert fn.team1 == "azure_bears_golden" and fn.team2 == "ceub_octopus_vulgaris"
    assert (fn.score1, fn.score2) == (13, 7)
    assert fn.map == "abyss"
    assert fn.date.isoformat() == "2026-09-19"


def test_regex_prefix_with_underscore():
    fn = parse_filename("RUSH_INCLUSIVO_004_01-07-26_time_a_13_x_11_time_b_lotus.json")
    assert fn.prefix == "RUSH_INCLUSIVO" and fn.match_num == "004"


def test_regex_rejects_garbage():
    assert parse_filename("qualquer_coisa.json") is None


def test_slugify():
    assert slugify("Mauá Blue") == "maua_blue"
    assert slugify("  UFMT--Turuna ") == "ufmt_turuna"


@requires_raw
def test_all_336_filenames_parse(raw_files):
    failures = [p.name for p in raw_files if parse_filename(p.name) is None]
    assert len(raw_files) == 336
    assert failures == [], f"nomes que falharam: {failures}"


@requires_raw
def test_group_stage_ids_have_letter(raw_files):
    group = [parse_filename(p.name) for p in raw_files if p.name.startswith("UNIVAVA_G_")]
    assert len(group) == 69
    assert all(fn.match_num[-1].isalpha() for fn in group)


@requires_raw
def test_team_mapping_matches_filename_score(frames, tables):
    m = frames["matches"]
    assert not [a for a in tables.anomalies if a["kind"] == "team_mapping"]
    for row in m.itertuples():
        # placar do nome do arquivo == roundsWon do time mapeado
        assert f"_{row.score_a}_x_{row.score_b}_" in row.file_name
