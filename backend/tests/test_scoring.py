import pytest
from app.scoring import ConfidenceMetrics, calculate_confidence


def metrics(value=1.0):
    return ConfidenceMetrics(value, value, value, value, value, value)


def test_perfect_metrics_can_score_100_when_gates_pass():
    result = calculate_confidence(metrics(1), True)
    assert result["score"] == 100.0
    assert result["band"] == "HIGH"


def test_failed_gate_clamps_score_to_low_even_when_raw_is_high():
    result = calculate_confidence(metrics(1), False)
    assert result["raw_score"] == 100.0
    assert result["score"] == 49.0
    assert result["band"] == "LOW"


def test_medium_band_boundaries():
    # Weight sum is one; set every component to the same raw fraction.
    assert calculate_confidence(metrics(.50), True)["band"] == "MEDIUM"
    assert calculate_confidence(metrics(.70), True)["band"] == "MEDIUM"
    assert calculate_confidence(metrics(.71), True)["band"] == "HIGH"


def test_rejects_metrics_outside_unit_interval():
    bad = ConfidenceMetrics(1.2, 1, 1, 1, 1, 1)
    with pytest.raises(ValueError):
        calculate_confidence(bad, True)
