import pytest

from scoutroom import config
from scoutroom.parse import build_tables, iter_match_files


def _has_raw() -> bool:
    return config.RAW_DIR.exists() and any(config.RAW_DIR.rglob("*.json"))


requires_raw = pytest.mark.skipif(not _has_raw(), reason="dados brutos ausentes em data/raw")


@pytest.fixture(scope="session")
def tables():
    return build_tables()


@pytest.fixture(scope="session")
def frames(tables):
    return tables.frames()


@pytest.fixture(scope="session")
def raw_files():
    return iter_match_files()
