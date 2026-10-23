"""Estatística comum (§6): implementada uma vez e reutilizada em todos os módulos."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np
from scipy import stats as sps

from . import config


def sample_badge(n: int) -> str:
    if n < config.SAMPLE_INSUFFICIENT:
        return "insufficient"
    if n < config.SAMPLE_OK:
        return "low"
    return "ok"


@dataclass(frozen=True)
class Prior:
    alpha: float
    beta: float

    @property
    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    @property
    def strength(self) -> float:
        return self.alpha + self.beta

    def to_dict(self) -> dict:
        return {"alpha": round(self.alpha, 4), "beta": round(self.beta, 4)}


UNIFORM_PRIOR = Prior(1.0, 1.0)


def fit_beta_prior(pairs: Iterable[tuple[int, int]]) -> Prior:
    """Beta(α, β) por método dos momentos sobre as proporções k/n das unidades (times ou jogadores).

    Variância entre unidades = variância observada − ruído binomial médio. Força α+β limitada a
    [PRIOR_MIN_STRENGTH, PRIOR_MAX_STRENGTH]. Unidades com n < PRIOR_MIN_N_PER_UNIT ficam de fora.
    """
    data = [(k, n) for k, n in pairs if n >= config.PRIOR_MIN_N_PER_UNIT]
    if not data:
        return UNIFORM_PRIOR
    k = np.array([d[0] for d in data], dtype=float)
    n = np.array([d[1] for d in data], dtype=float)
    p = k / n
    m = float(k.sum() / n.sum())
    m = min(max(m, 1e-3), 1 - 1e-3)
    if len(data) < 3:
        s = config.PRIOR_MIN_STRENGTH
    else:
        var_obs = float(np.var(p, ddof=1))
        noise = float(np.mean(m * (1 - m) / n))
        var_between = var_obs - noise
        if var_between <= 0:
            s = config.PRIOR_MAX_STRENGTH
        else:
            s = m * (1 - m) / var_between - 1
    s = min(max(s, config.PRIOR_MIN_STRENGTH), config.PRIOR_MAX_STRENGTH)
    return Prior(m * s, (1 - m) * s)


def posterior(k: int, n: int, prior: Prior, level: float = config.CRED_LEVEL) -> dict:
    a = k + prior.alpha
    b = n - k + prior.beta
    lo_q = (1 - level) / 2
    return {
        "k": int(k),
        "n": int(n),
        "alpha": round(prior.alpha, 4),
        "beta": round(prior.beta, 4),
        "mean": round(a / (a + b), 4),
        "lo": round(float(sps.beta.ppf(lo_q, a, b)), 4),
        "hi": round(float(sps.beta.ppf(1 - lo_q, a, b)), 4),
        "raw": round(k / n, 4) if n else None,
        "badge": sample_badge(n),
    }


def beta_moments(k: int, n: int, prior: Prior) -> tuple[float, float]:
    a = k + prior.alpha
    b = n - k + prior.beta
    mean = a / (a + b)
    var = a * b / ((a + b) ** 2 * (a + b + 1))
    return mean, var


def prob_greater(mean_a: float, var_a: float, mean_b: float, var_b: float) -> float:
    """P(A > B) por aproximação normal das posteriores."""
    sd = math.sqrt(var_a + var_b)
    if sd == 0:
        return 0.5 if mean_a == mean_b else float(mean_a > mean_b)
    return 0.5 * (1.0 + math.erf((mean_a - mean_b) / (sd * math.sqrt(2.0))))


def compare_to_league(k: int, n: int, prior: Prior, league_k: int, league_n: int) -> float:
    """P(taxa do time > taxa da liga). Liga com posterior Beta(K+1, N−K+1)."""
    ma, va = beta_moments(k, n, prior)
    mb, vb = beta_moments(league_k, league_n, UNIFORM_PRIOR)
    return prob_greater(ma, va, mb, vb)


def is_probable(p: float) -> bool:
    return p > config.PROB_THRESHOLD or p < 1 - config.PROB_THRESHOLD


def median_summary(values: Sequence[float], seed: int = config.SEED) -> dict:
    """Mediana + IQR (+ IC bootstrap 80% da mediana se n >= BOOTSTRAP_MIN_N)."""
    arr = np.asarray([v for v in values if v is not None and not (isinstance(v, float) and math.isnan(v))], dtype=float)
    n = int(arr.size)
    out = {"n": n, "badge": sample_badge(n), "median": None, "q1": None, "q3": None, "ci_lo": None, "ci_hi": None}
    if n == 0:
        return out
    out["median"] = round(float(np.median(arr)), 1)
    out["q1"] = round(float(np.percentile(arr, 25)), 1)
    out["q3"] = round(float(np.percentile(arr, 75)), 1)
    if n >= config.BOOTSTRAP_MIN_N:
        rng = np.random.default_rng(seed)
        idx = rng.integers(0, n, size=(config.BOOTSTRAP_RESAMPLES, n))
        meds = np.median(arr[idx], axis=1)
        lo_q = (1 - config.CRED_LEVEL) / 2
        out["ci_lo"] = round(float(np.quantile(meds, lo_q)), 1)
        out["ci_hi"] = round(float(np.quantile(meds, 1 - lo_q)), 1)
    return out


def mean_summary(values: Sequence[float]) -> dict:
    arr = np.asarray(list(values), dtype=float)
    n = int(arr.size)
    if n == 0:
        return {"n": 0, "mean": None, "sd": None, "badge": sample_badge(0)}
    return {
        "n": n,
        "mean": round(float(arr.mean()), 3),
        "sd": round(float(arr.std(ddof=1)), 3) if n > 1 else None,
        "badge": sample_badge(n),
    }
