# Auditoria do schema (Fase 0)

Gerado automaticamente por `scoutroom audit` a partir dos JSON brutos em `data/raw/` (link para a pasta `dados/` entregue pela organização). Nenhum dado externo.

**Arquivos encontrados (busca recursiva `rglob('*.json')`): 336**

## 1. Estrutura de diretórios

| pasta | esperado | encontrado | ok |
| --- | ---: | ---: | :---: |
| Rush Series Esquenta | 29 | 29 | ✅ |
| Rush Series Esquenta 2 | 26 | 26 | ✅ |
| Rush Series Inclusivo | 13 | 13 | ✅ |
| Univavá / Classificatória 1 | 55 | 55 | ✅ |
| Univavá / Classificatória 2 | 39 | 39 | ✅ |
| Univavá / Classificatória 3 | 43 | 43 | ✅ |
| Univavá / Classificatória 4 | 62 | 62 | ✅ |
| Univavá / Fase de Grupos | 69 | 69 | ✅ |

## 2. Nome do arquivo

Regex (ID alfanumérico para a Fase de Grupos, ex.: `001a`):

```
^(?P<prefix>[A-Z0-9_]+?)_(?P<match_num>\d+[a-zA-Z]?)_(?P<date>\d{2}-\d{2}-\d{2})_(?P<team1>.+?)_(?P<score1>\d+)_x_(?P<score2>\d+)_(?P<team2>.+?)_(?P<map>[a-z]+)\.json$
```

- Nomes que falharam: **0** 
- IDs com sufixo de letra: 75 (prefixos: {'RUSHE': 2, 'RUSH2': 2, 'RUSH_INCLUSIVO': 2, 'UNIVAVA_G': 69})
- Prefixos: {'RUSHE': 29, 'RUSH2': 26, 'RUSH_INCLUSIVO': 13, 'UNIVAVA_C1': 55, 'UNIVAVA_C2': 39, 'UNIVAVA_C3': 43, 'UNIVAVA_C4': 62, 'UNIVAVA_G': 69}
- Partidas com placar empatado no nome: 0 (desempate por elenco não foi necessário)
- Anomalias no mapeamento Blue/Red ↔ time (§5.2): 0

## 3. Campos confirmados

- **topo**: `coaches`, `matchInfo`, `players`, `roundResults`, `teams`
- **matchInfo**: `customGameName`, `gameLengthMillis`, `gameMode`, `gameStartMillis`, `gameVersion`, `isCompleted`, `isRanked`, `mapId`, `matchId`, `premierMatchInfo`, `provisioningFlowId`, `queueId`, `region`, `seasonId`
- **players[]**: `accountLevel`, `characterId`, `competitiveTier`, `gameName`, `isObserver`, `partyId`, `playerCard`, `playerTitle`, `puuid`, `stats`, `tagLine`, `teamId`
- **players[].stats**: `abilityCasts`, `assists`, `deaths`, `kills`, `playtimeMillis`, `roundsPlayed`, `score`
- **players[].stats.abilityCasts**: `ability1Casts`, `ability2Casts`, `grenadeCasts`, `ultimateCasts`
- **coaches[]**: `puuid`, `teamId`
- **teams[]**: `numPoints`, `rank` (44/672), `roundsPlayed`, `roundsWon`, `teamId`, `won`
- **roundResults[]**: `bombDefuser`, `bombPlanter`, `defuseLocation`, `defusePlayerLocations`, `defuseRoundTime`, `plantLocation`, `plantPlayerLocations`, `plantRoundTime`, `plantSite`, `playerStats`, `roundCeremony`, `roundNum`, `roundResult`, `roundResultCode`, `winningTeam`, `winningTeamRole`
- **roundResults[].playerStats[]**: `ability`, `damage`, `economy`, `kills`, `puuid`, `score`
- **playerStats[].economy**: `armor`, `loadoutValue`, `remaining`, `spent`, `weapon`
- `playerStats[].ability.*Effects` não nulos: **0** de 264720 (confirmado: sempre `null` por round; habilidades só agregadas em `players[].stats.abilityCasts`).
- `players` por arquivo: {10: 314, 11: 22}. **22 arquivos trazem 1 observador** (`teamId: "Neutral"`, `isObserver: true`, `stats: null`) — descartado das métricas.
- `coaches`: 217 entradas no total, sempre fora de `players` (ignoradas nas métricas).
- `isCompleted`: {True: 336} → nenhuma partida incompleta.
- `gameVersion` (prefixo): {'release-12.10': 29, 'release-12.11': 26, 'release-13.00': 55, 'release-13.01': 39, 'release-13.02': 56, 'release-13.05': 109, 'release-13.06': 22}
- `len(roundResults) == roundsPlayed`: {True: 336}
- Maior `roundNum`: **35** (0-indexado). Partidas com prorrogação (> 24 rounds): 19.

### Mapas (`matchInfo.mapId` × sufixo do arquivo)

| sufixo | mapId | partidas |
| --- | --- | ---: |
| ascent | `/Game/Maps/Ascent/Ascent` | 86 |
| lotus | `/Game/Maps/Jam/Jam` | 82 |
| haven | `/Game/Maps/Triad/Triad` | 75 |
| split | `/Game/Maps/Bonsai/Bonsai` | 36 |
| sunset | `/Game/Maps/Juliett/Juliett` | 24 |
| abyss | `/Game/Maps/Infinity/Infinity` | 13 |
| summit | `/Game/Maps/Plummet/Plummet` | 10 |
| breeze | `/Game/Maps/Foxtrot/Foxtrot` | 5 |
| pearl | `/Game/Maps/Pitt/Pitt` | 3 |
| fracture | `/Game/Maps/Canyon/Canyon` | 2 |

Cada sufixo corresponde a exatamente um `mapId` (dicionário gerado em `data/dictionaries/maps.json`).

### `roundResult` × `roundResultCode`

| roundResult | roundResultCode | n |
| --- | --- | ---: |
| Eliminated | `'Elimination'` | 4597 |
| Bomb defused | `'Defuse'` | 1349 |
| Bomb detonated | `'Detonate'` | 522 |
| Round timer expired | `''` | 150 |

Confirmado: `roundResultCode` vem **vazio** quando o tempo expira → usamos `roundResult`.

### `roundCeremony`

| valor | n |
| --- | ---: |
| `'CeremonyDefault'` | 4977 |
| `'CeremonyFlawless'` | 544 |
| `'CeremonyCloser'` | 484 |
| `'CeremonyClutch'` | 247 |
| `'CeremonyThrifty'` | 215 |
| `'CeremonyTeamAce'` | 84 |
| `'CeremonyAce'` | 67 |

### `plantSite`

| valor | n |
| --- | ---: |
| `'A'` | 2040 |
| `''` | 1965 |
| `'B'` | 1603 |
| `'C'` | 1010 |

Sites por mapa: abyss: AB, ascent: AB, breeze: AB, fracture: AB, haven: ABC, lotus: ABC, pearl: AB, split: AB, summit: AB, sunset: AB

## 4. Snapshots (`plantPlayerLocations`, `defusePlayerLocations`, `kills[].playerLocations`)

- Snapshots analisados: 6002; com `teamId` no objeto: **0**; com jogadores dos dois times misturados: **4553**.
- Conclusão: lista de todos os vivos dos dois times, sem time → join obrigatório com `players` (feito no pipeline).
- `viewRadians` observado em [0.0000, 6.2830] ⊂ [0, 2π).
- Rounds com plant: 4653; snapshots de plant: 4653 (1 por plant); defuses: 1349, snapshots de defuse: 1349.

### Referencial de `viewRadians`

Validação com abates por arma: diferença angular circular entre a mira do matador no instante do abate e a direção até a vítima (amostra aleatória de 11290 abates, seed fixa).

| hipótese | mediana da diferença | % dentro de ±15° |
| --- | ---: | ---: |
| atan2(Δy, Δx) mod 2π | 0.3° | 100.0% |
| atan2(Δx, Δy) (eixos trocados) | 90.1° | 5.9% |
| atan2(−Δy, Δx) (y invertido) | 90.2° | 11.5% |

Confirmado: `viewRadians = atan2(Δy, Δx) mod 2π` no sistema (x, y) do jogo.

## 5. Anomalias críticas

### 5.1 Mortes para a Spike / auto-abates

- Eventos com `damageType == "Bomb"`: **327**, dos quais `killer == victim`: 327.
- Auto-abates (`killer == victim`) por tipo: {'Bomb': 327, 'Ability': 5, 'Fall': 40, 'Crush': 1} (quedas também aparecem como auto-abate).
- Abates em companheiro de time (teamkill): 9.

Invariância por partida — soma de eventos em `playerStats[].kills` == soma de `players[].stats.kills`:

| filtro | partidas ok | partidas com falha |
| --- | ---: | ---: |
| todos os eventos | 166 | 170 |
| sem bomba/auto-abate | 328 | 8 |
| sem bomba/auto-abate e sem teamkill | 336 | 0 |

Regra adotada (§5.3): estatísticas de abate usam `not is_self_or_bomb_kill and not is_team_kill` (view `valid_kills` no DuckDB). Com ela a invariância vale em 100% das partidas.

### 5.2 Partidas por time e por jogador

- Times distintos: **68**; com ≥ 5 partidas: **47**; com ≥ 10 partidas: **29**.
- Jogadores distintos (puuid): 411; com ≥ 5 partidas: 242; jogadores que aparecem em mais de um time: 24.
- Partidas incompletas (`isCompleted: false`): 0.

| time (slug) | partidas |
| --- | ---: |
| ufmt_turuna | 36 |
| azure_bears_black | 33 |
| azure_bears_golden | 32 |
| ceub_octopus_vulgaris | 30 |
| uscs_hawks | 25 |
| totale_umc | 24 |
| fei_darkowls | 22 |
| a2e_uff | 18 |
| caap_hellhounds | 18 |
| ufu_saints | 18 |
| ufpr_bbn | 17 |
| wolf_gaming | 16 |
| inatel_legacy | 14 |
| minerva_thunders | 14 |
| fei_whiteowls | 13 |
| caap_auroras | 13 |
| axis_anteaters | 13 |
| maua_blue | 13 |
| unicamp_tritons_black | 12 |
| octacore_python | 12 |
| pucc_cardinals | 12 |
| green_owls_noctua | 12 |
| furia_utfpr | 12 |
| green_owls_jacurutu | 12 |
| inatel | 11 |
| poli_plague | 11 |
| macklogic_red | 11 |
| caap_malditos | 11 |
| usp_stars | 11 |
| ceub_octopus | 9 |
| inatel_gray | 8 |
| caap_momentum | 8 |
| pucgo_sistematica | 8 |
| inatel_dois | 8 |
| macklogic_rainbow | 7 |
| azure_bears_silver | 7 |
| unifesp_erex | 7 |
| liga_vulkanica | 7 |
| ufmg_fenix_b | 7 |
| fatec_pg | 6 |
| octacore_javascript | 6 |
| unicamp_tritons_red | 6 |
| ufu_saints_auryn | 6 |
| pucgo_sistematica_academy | 6 |
| ufg_eagles_blue | 5 |
| fametro_berserkers | 5 |
| macklogic_white | 5 |
| ime_wolves_red | 4 |
| ibmec_sharks | 4 |
| panterao_gaming | 4 |
| ufg_eagles | 4 |
| brutal_esports | 4 |
| gambiarra_ufg | 4 |
| tigre_branco | 3 |
| azure_bears_white | 3 |
| axis_aura | 3 |
| ufrj_minerva | 3 |
| ufu_saints_trigons | 3 |
| usp_stars_gc | 3 |
| pucc_canaries | 2 |
| homem_passaro | 2 |
| ufg_gc_eagles | 2 |
| unirio_krakens | 2 |
| gdu_ufpb | 1 |
| rahnag | 1 |
| sistematica_unievangelica | 1 |
| sheriff_iff | 1 |
| nox_unievangelica | 1 |

Distribuição (nº de partidas → nº de times): 1→5, 2→4, 3→6, 4→6, 5→3, 6→5, 7→5, 8→4, 9→1, 11→5, 12→6, 13→4, 14→2, 16→1, 17→1, 18→3, 22→1, 24→1, 25→1, 30→1, 32→1, 33→1, 36→1

Jogadores (nº de partidas → nº de jogadores): 1→41, 2→43, 3→38, 4→47, 5→32, 6→22, 7→27, 8→16, 9→18, 10→9, 11→21, 12→20, 13→13, 14→5, 15→5, 16→7, 17→5, 18→9, 19→2, 21→2, 22→3, 23→1, 24→4, 25→2, 29→2, 30→5, 32→5, 33→3, 36→4

### 5.3 Lado por round (§5.4)

- Lado derivado de `winningTeam` + `winningTeamRole`. Inconsistências: plantador fora do ataque = 0; defusador fora da defesa = 0.
- Na prorrogação, fração de rounds consecutivos com troca de lado: 1.00 (esperado ≈ 1, troca a cada round).
- Partidas em que o atacante muda dentro do 1º tempo: 0.

## 6. Economia — histograma para validar os limiares (§9.1)

Média de `loadoutValue` dos 5 jogadores por time e round (rounds 1–11 e 13–23):

| faixa | n | |
| --- | ---: | --- |
| 0–249 | 76 | `█` |
| 250–499 | 260 | `████` |
| 500–749 | 234 | `████` |
| 750–999 | 105 | `██` |
| 1000–1249 | 88 | `█` |
| 1250–1499 | 145 | `██` |
| 1500–1749 | 254 | `████` |
| 1750–1999 | 329 | `█████` |
| 2000–2249 | 280 | `█████` |
| 2250–2499 | 222 | `████` |
| 2500–2749 | 212 | `███` |
| 2750–2999 | 264 | `████` |
| 3000–3249 | 367 | `██████` |
| 3250–3499 | 463 | `████████` |
| 3500–3749 | 419 | `███████` |
| 3750–3999 | 660 | `███████████` |
| 4000–4249 | 928 | `███████████████` |
| 4250–4499 | 1691 | `████████████████████████████` |
| 4500–4749 | 2449 | `████████████████████████████████████████` |
| 4750–4999 | 1325 | `██████████████████████` |
| 5000–5249 | 707 | `████████████` |
| 5250–5499 | 224 | `████` |
| 5500–5749 | 29 | `` |
| 5750–5999 | 1 | `` |

Com os limiares eco < 1600, force 1600–3499, full ≥ 3500: eco = 8.4%, force = 19.7%, full = 71.9%.

Pistols (rounds 0 e 12): média 783; prorrogação (≥ 24): média 4663 (classificados como full).

Contagem de jogadores por time e round: {5: 13236}

## 7. Tabelas geradas (§5.3)

| tabela | linhas | colunas |
| --- | ---: | --- |
| matches | 336 | match_id, file_name, source, prefix, match_num, date, map, map_id, patch, team_a, team_b, team_a_id, team_b_id, score_a, score_b, winner, length_ms, start_ms, is_completed, n_rounds, rounds_played_teams, is_overtime, n_observers, n_coaches |
| rounds | 6618 | match_id, round_num, winning_team_id, winning_team, winning_role, result, result_code, ceremony, plant_site, plant_time_ms, defuse_time_ms, plant_x, plant_y, defuse_x, defuse_y, planter, defuser, atk_team_id, def_team_id, atk_team, def_team |
| round_players | 66180 | match_id, round_num, puuid, team_id, team_slug, role, loadout_value, spent, remaining, weapon_guid, armor_guid, round_kills_raw, round_damage, round_score |
| kills | 46753 | match_id, round_num, t_ms, t_game_ms, killer, killer_team, victim, victim_team, victim_x, victim_y, damage_type, damage_item, is_self_or_bomb_kill, is_team_kill |
| plant_snapshot | 30545 | match_id, round_num, puuid, team_id, team_slug, role, x, y, view_rad, spent |
| defuse_snapshot | 3333 | match_id, round_num, puuid, team_id, team_slug, role, x, y, view_rad, spent |
| players | 3360 | match_id, puuid, team_id, team_slug, agent_guid, kills, deaths, assists, score, rounds_played, grenade_casts, ability1_casts, ability2_casts, ultimate_casts |

Arquivos: `data/tables/*.parquet` e `data/scoutroom.duckdb` (view `valid_kills`).
