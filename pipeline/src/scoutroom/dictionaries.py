"""GUID -> nome (§5.6). Somente arquivos locais; GUID desconhecido nunca quebra o pipeline."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from . import config

MAP_NAMES = {
    "ascent": "Ascent", "lotus": "Lotus", "haven": "Haven", "split": "Split", "sunset": "Sunset",
    "abyss": "Abyss", "summit": "Summit", "breeze": "Breeze", "pearl": "Pearl", "fracture": "Fracture",
    "bind": "Bind", "icebox": "Icebox", "corrode": "Corrode",
}


def _load(name: str) -> dict:
    p = Path(config.DICT_DIR) / name
    if not p.exists():
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def agents() -> dict:
    return {k.lower(): v for k, v in _load("agents.json").items() if not k.startswith("_")}


@lru_cache(maxsize=1)
def weapons() -> dict:
    return _load("weapons.json")


def agent_name(guid: str | None) -> str:
    if not guid:
        return "Desconhecido"
    a = agents().get(guid.lower())
    return a["name"] if a else f"Agente #{guid[:4].lower()}"


def agent_role(guid: str | None) -> str:
    a = agents().get((guid or "").lower())
    return a["role"] if a else ""


def weapon_name(guid: str | None) -> str:
    if not guid:
        return "Nenhuma"
    g = guid.upper()
    w = weapons()
    if g in w.get("weapons", {}):
        return w["weapons"][g]["name"]
    if g in w.get("ability_weapons", {}):
        return w["ability_weapons"][g]
    return f"Item #{g[:4].lower()}"


def armor_name(guid: str | None) -> str:
    if not guid:
        return "Sem escudo"
    a = weapons().get("armor", {}).get(guid.upper())
    return a["name"] if a else f"Item #{guid[:4].lower()}"


def damage_item_name(damage_type: str, item: str) -> str:
    if damage_type == "Weapon":
        return weapon_name(item) if item else "Arma"
    if damage_type == "Ability":
        return "Habilidade"
    if damage_type == "Melee":
        return "Faca"
    return {"Bomb": "Spike", "Fall": "Queda", "Crush": "Esmagamento"}.get(damage_type, damage_type or "?")


def build_maps_dictionary(map_ids: dict[str, set]) -> dict:
    """Constrói data/dictionaries/maps.json cruzando mapId com o sufixo do nome do arquivo.

    Não há constantes de conversão para imagem de minimapa (não usamos arte da Riot):
    o front desenha um esquema abstrato a partir das próprias coordenadas da liga.
    """
    out = {}
    for slug, ids in sorted(map_ids.items()):
        for mid in sorted(ids):
            out[mid] = {"slug": slug, "name": MAP_NAMES.get(slug, slug.title()), "codename": mid.rsplit("/", 1)[-1]}
    return out


def write_maps_dictionary(map_ids: dict[str, set]) -> dict:
    d = build_maps_dictionary(map_ids)
    payload = {"_comment": "Gerado automaticamente pelo pipeline (matchInfo.mapId x sufixo do nome do arquivo)."} | d
    with open(Path(config.DICT_DIR) / "maps.json", "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return d
