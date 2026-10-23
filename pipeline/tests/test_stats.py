import numpy as np
import pytest

from scoutroom import config
from scoutroom.stats import (Prior, compare_to_league, fit_beta_prior, median_summary, posterior, prob_greater,
                             sample_badge)


def test_sample_badge_thresholds():
    assert sample_badge(0) == "insufficient"
    assert sample_badge(config.SAMPLE_INSUFFICIENT - 1) == "insufficient"
    assert sample_badge(config.SAMPLE_INSUFFICIENT) == "low"
    assert sample_badge(config.SAMPLE_OK - 1) == "low"
    assert sample_badge(config.SAMPLE_OK) == "ok"


@pytest.mark.parametrize("prior", [Prior(1, 1), Prior(5, 3), Prior(40, 60), Prior(0.5, 0.5)])
def test_shrinkage_in_unit_interval_and_monotone_in_k(prior):
    n = 20
    means = []
    for k in range(n + 1):
        p = posterior(k, n, prior)
        assert 0 <= p["lo"] <= p["mean"] <= p["hi"] <= 1
        means.append(p["mean"])
    assert all(b > a for a, b in zip(means, means[1:]))


def test_shrinkage_pulls_toward_prior_mean():
    prior = Prior(30, 70)  # média 0,3
    p = posterior(9, 10, prior)
    assert prior.mean < p["mean"] < 0.9


def test_fit_beta_prior_recovers_mean():
    rng = np.random.default_rng(1)
    true = rng.beta(20, 30, size=40)
    pairs = [(int(rng.binomial(100, t)), 100) for t in true]
    pr = fit_beta_prior(pairs)
    assert abs(pr.mean - 0.4) < 0.05
    assert config.PRIOR_MIN_STRENGTH <= pr.strength <= config.PRIOR_MAX_STRENGTH


def test_fit_beta_prior_ignores_small_units():
    pr = fit_beta_prior([(1, 1), (0, 2)])
    assert pr == Prior(1.0, 1.0)


def test_prob_greater():
    assert prob_greater(0.6, 0.001, 0.4, 0.001) > 0.99
    assert abs(prob_greater(0.5, 0.01, 0.5, 0.01) - 0.5) < 1e-9
    assert compare_to_league(80, 100, Prior(1, 1), 500, 1000) > 0.99


def test_bootstrap_is_reproducible():
    vals = list(np.random.default_rng(3).normal(40, 10, size=50))
    a, b = median_summary(vals), median_summary(vals)
    assert a == b
    assert a["ci_lo"] <= a["median"] <= a["ci_hi"]


def test_bootstrap_skipped_for_small_n():
    s = median_summary([10, 20, 30])
    assert s["n"] == 3 and s["ci_lo"] is None and s["median"] == 20
