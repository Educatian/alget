# Learner Model Validation Smoke Test

Synthetic-data check for ALGET learner-model calibration and baseline comparison.

| Model | N | Brier | ECE | AUC | Mean predicted | Mean true |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rule_only_accuracy | 6144 | 0.1219 | 0.0793 | 0.8953 | 0.6186 | 0.6979 |
| bkt_only | 6144 | 0.1573 | 0.142 | 0.8485 | 0.5559 | 0.6979 |
| telemetry_fused_bkt | 6144 | 0.1628 | 0.1 | 0.8302 | 0.6164 | 0.6979 |
| tuned_bkt | 6144 | 0.1048 | 0.0213 | 0.9185 | 0.7146 | 0.6979 |
| tuned_telemetry_fused_bkt | 6144 | 0.1053 | 0.0154 | 0.9174 | 0.6936 | 0.6979 |

## Best Tuned Configuration

- `bkt_only`: `{"p_guess": 0.2, "p_known_initial": 0.1, "p_slip": 0.1, "p_transit": 0.1, "telemetry_intensity": 0}`
- `telemetry_fused_bkt`: `{"p_guess": 0.2, "p_known_initial": 0.1, "p_slip": 0.1, "p_transit": 0.1, "telemetry_intensity": 1.0}`
- `tuned_bkt`: `{"p_guess": 0.25, "p_known_initial": 0.65, "p_slip": 0.06, "p_transit": 0.14, "telemetry_intensity": 0}`
- `tuned_telemetry_fused_bkt`: `{"p_guess": 0.18, "p_known_initial": 0.5, "p_slip": 0.12, "p_transit": 0.06, "telemetry_intensity": 0.35}`

Interpretation: lower Brier/ECE and higher AUC indicate better learner-state tracking. This is not deployment evidence; it is a reproducible pipeline smoke test and calibration harness.
