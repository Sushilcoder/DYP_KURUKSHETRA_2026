from __future__ import annotations
from dataclasses import dataclass, asdict

@dataclass
class ConfidenceMetrics:
    extraction_completeness: float
    execution_success: float
    exercise_test_integrity: float
    version_reproducibility: float
    layout_export_integrity: float
    educational_quality: float

WEIGHTS = {
    "extraction_completeness": 0.15,
    "execution_success": 0.25,
    "exercise_test_integrity": 0.15,
    "version_reproducibility": 0.10,
    "layout_export_integrity": 0.15,
    "educational_quality": 0.20,
}

def calculate_confidence(metrics: ConfidenceMetrics, mandatory_gates_passed: bool) -> dict:
    values = asdict(metrics)
    for key, value in values.items():
        if not 0.0 <= value <= 1.0:
            raise ValueError(f"{key} must be between 0 and 1")
    raw = round(100 * sum(values[k] * w for k, w in WEIGHTS.items()), 2)
    final = raw if mandatory_gates_passed else min(raw, 49.0)
    if final < 50:
        band = "LOW"
    elif final <= 70:
        band = "MEDIUM"
    else:
        band = "HIGH"
    return {
        "score": final,
        "raw_score": raw,
        "scale": "0-100",
        "band": band,
        "mandatory_gates_passed": mandatory_gates_passed,
        "weights": WEIGHTS,
        "metrics": values,
        "formula": "100 * (0.15*A + 0.25*E + 0.15*T + 0.10*V + 0.15*L + 0.20*Q)",
        "note": "A high score is not proof by itself; all mandatory verification gates must pass.",
    }
