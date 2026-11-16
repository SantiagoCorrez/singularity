"""Calibración en CI: se vuelve a ejecutar cada prueba y se compara con lo guardado.

Si alguien cambia un método de medida sin recalibrar, o si una medida deja de cumplir su
umbral, esto falla. Para actualizar: python -m singularity_api.calibration.run
"""
import json

import pytest

from singularity_api.calibration import run
from singularity_api.calibration.registry import RESULTS_PATH, calibration_for, method_for

STORED = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))


def test_every_measurement_has_a_stored_calibration():
    assert set(STORED) == set(run.TESTS)


@pytest.mark.parametrize("key", sorted(run.TESTS))
def test_calibration_reproduces(key):
    fn, metric, threshold, lower_is_better, _ref = run.TESTS[key]
    stored = STORED[key]
    assert stored["method"] == method_for(key), "el método cambió: hay que recalibrar"
    assert stored["calibration"]["metric"] == metric
    assert stored["calibration"]["threshold"] == threshold

    score, n = fn()
    passed = score <= threshold if lower_is_better else score >= threshold
    assert passed == stored["calibration"]["passed"], f"{key}: {metric}={score:.3f}, umbral {threshold}"
    assert n == stored["calibration"]["n"]
    assert score == pytest.approx(stored["calibration"]["score"], abs=max(0.02, 0.05 * abs(threshold)))


def test_stale_method_drops_the_calibration(monkeypatch):
    from singularity_api.audio import descriptors

    monkeypatch.setitem(descriptors.METHODS, "tempo", "otro método · v2")
    assert calibration_for("tempo") is None
