"""Registro de proporções por unidade (time ou jogador): prior empírico por métrica + evidências."""
from __future__ import annotations

from collections import defaultdict

import pandas as pd

from . import config
from .stats import Prior, compare_to_league, fit_beta_prior, posterior

Ref = tuple[str, int]  # (match_id, round_num)


class PropRegistry:
    """Guarda (k, n, rounds sim, rounds não) por métrica e unidade; ajusta o prior por métrica."""

    def __init__(self) -> None:
        self.data: dict[str, dict[str, tuple[int, int, list[Ref], list[Ref]]]] = defaultdict(dict)
        self.priors: dict[str, Prior] = {}

    def add(self, metric: str, unit: str, k: int, n: int, yes: list[Ref] | None = None, no: list[Ref] | None = None) -> None:
        self.data[metric][unit] = (int(k), int(n), yes or [], no or [])

    def add_frame(self, metric: str, df: pd.DataFrame, unit_col: str, success: pd.Series | str) -> None:
        """Uma linha de `df` = uma tentativa; `success` booleano por linha. Precisa de match_id/round_num."""
        if isinstance(success, str):
            success = df[success]
        df = df.assign(_ok=success.astype(bool).values)
        for unit, g in df.groupby(unit_col, sort=False):
            ok = g["_ok"].values
            refs = list(zip(g["match_id"].values, g["round_num"].values.astype(int)))
            yes = [r for r, o in zip(refs, ok) if o]
            no = [r for r, o in zip(refs, ok) if not o]
            self.add(metric, unit, int(ok.sum()), len(ok), yes, no)

    def prior(self, metric: str) -> Prior:
        if metric not in self.priors:
            self.priors[metric] = fit_beta_prior((k, n) for k, n, _, _ in self.data[metric].values())
        return self.priors[metric]

    def league(self, metric: str) -> tuple[int, int]:
        vals = self.data[metric].values()
        return sum(v[0] for v in vals), sum(v[1] for v in vals)

    def get(self, metric: str, unit: str, with_league: bool = True) -> dict | None:
        entry = self.data.get(metric, {}).get(unit)
        if entry is None:
            return None
        k, n, _, _ = entry
        if n == 0:
            return None
        p = self.prior(metric)
        out = posterior(k, n, p)
        out["id"] = metric
        if with_league:
            lk, ln = self.league(metric)
            out["league"] = round(lk / ln, 4) if ln else None
            out["league_n"] = ln
            out["p_gt_league"] = round(compare_to_league(k, n, p, lk, ln), 4)
        return out

    def evidence(self, metric: str, unit: str) -> dict | None:
        entry = self.data.get(metric, {}).get(unit)
        if entry is None:
            return None
        _, _, yes, no = entry
        return {"yes": yes, "no": no, "yes_total": len(yes), "no_total": len(no)}

    def units(self, metric: str) -> list[str]:
        return list(self.data.get(metric, {}).keys())

    def metrics(self) -> list[str]:
        return list(self.data.keys())
