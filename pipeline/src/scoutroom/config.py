"""Limiares e parâmetros em um único lugar.

Qualquer ajuste aqui deve ser registrado em docs/DECISIONS.md (valor antigo, novo e motivo).
Os valores relevantes para a interface são exportados em league.json -> params.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = ROOT / "data" / "raw"
DICT_DIR = ROOT / "data" / "dictionaries"
PRIVATE_DIR = ROOT / "data" / "private"
TABLES_DIR = ROOT / "data" / "tables"
DUCKDB_PATH = ROOT / "data" / "scoutroom.duckdb"
WEB_DATA_DIR = ROOT / "web" / "public" / "data"
DOCS_DIR = ROOT / "docs"

SEED = 20261023

# Selo de amostra: n < INSUFFICIENT -> "insuficiente"; n < OK -> "confiança baixa"; senão "ok".
SAMPLE_INSUFFICIENT = 5
SAMPLE_OK = 15

# Intervalo de credibilidade (80%).
CRED_LEVEL = 0.80

# Comparação de taxas: "diferença provável" se P(A > B) > PROB_THRESHOLD (ou < 1 - PROB_THRESHOLD).
PROB_THRESHOLD = 0.90

# Prior empírico (método dos momentos): limites da força alpha + beta.
PRIOR_MIN_STRENGTH = 2.0
PRIOR_MAX_STRENGTH = 200.0
PRIOR_MIN_N_PER_UNIT = 5  # só times/jogadores com n >= 5 entram no ajuste do prior

# Bootstrap da mediana.
BOOTSTRAP_RESAMPLES = 1000
BOOTSTRAP_MIN_N = 10

# Economia (média de loadoutValue dos 5 jogadores do time no round).
# Validado no histograma dos 336 jogos (docs/schema_audit.md).
ECO_MAX = 1600     # eco: média < 1600
FULL_MIN = 3500    # force: 1600 <= média < 3500; full: >= 3500
PISTOL_ROUNDS = (0, 12)
REGULATION_ROUNDS = 24  # rounds 0..23; >= 24 é prorrogação (classificado como "full")

# Insight cards.
INSIGHT_MIN_N = 5
INSIGHT_SHARE_RATIO = 1.25  # participação >= 1,25x o esperado numa distribuição uniforme
INSIGHT_MAX_CARDS = 8

# Veto.
VETO_KAPPA = 12.0
VETO_PRIOR_CLAMP = (0.05, 0.95)

# Pós-plant.
AIM_TOLERANCE_RAD = 3.141592653589793 / 3  # ±60°
LURK_FACTOR = 2.0  # atacante a mais de 2R do plant

# Retorno em 2 rounds: "claramente abaixo" = P(alternativa > decisão) > PROB_THRESHOLD,
# com n >= SAMPLE_OK nos dois contextos, diferença >= REVIEW_MIN_GAP rounds e alternativa viável
# com os créditos do time (média de loadoutValue + remaining >= limiar da alternativa).
REVIEW_MIN_GAP = 0.20

# Evidências: no máximo N rounds por métrica.
EVIDENCE_MAX = 60
