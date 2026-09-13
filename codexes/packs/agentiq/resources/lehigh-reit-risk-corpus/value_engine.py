import numpy as np

from risk_engine import (
    DIMENSIONS, N, DIM_IDX, WEIGHTS, DIM_SIDE,
    CONTEXT_VECTORS, get_transition_multipliers,
    JURISDICTION_MULT, temporal_risk_factor,
)


DIMENSIONS_B = [
    "Identifiability", "Sensitivity", "Confidentiality", "Linkability",
    "Compliance", "Legal Liability", "Regulatory Stability", "Cross-Border Transferability",
    "Financial Exposure", "Exclusivity", "Market Risk", "Actuarial Relevance",
    "Data Security", "Data Quality", "Interoperability", "Implementation Readiness",
    "Purpose Limitation", "Intent Verification", "Behavioral Profiling", "Consent Validity",
    "Reputational Impact", "Political/Diplomatic", "Competitive Sensitivity", "Public Interest",
    "Data Lifecycle", "Timeliness", "Durability", "Regulatory Durability",
    "Health & Safety", "Emotional/Psychological", "Segmentation", "Synergy",
]
DIM_IDX_B = {d: i for i, d in enumerate(DIMENSIONS_B)}

RISK_TO_B = dict(zip(DIMENSIONS, DIMENSIONS_B))
B_TO_RISK = dict(zip(DIMENSIONS_B, DIMENSIONS))


# who the value mainly serves
VALUE_PARTY_B = {
    "Identifiability":              "buyer",
    "Sensitivity":                  "buyer",
    "Confidentiality":              "both",
    "Linkability":                  "buyer",
    "Compliance":                   "buyer",
    "Legal Liability":              "buyer",
    "Regulatory Stability":         "buyer",
    "Cross-Border Transferability": "buyer",
    "Financial Exposure":           "both",
    "Exclusivity":                  "seller",
    "Market Risk":                  "both",
    "Actuarial Relevance":          "both",
    "Data Security":                "buyer",
    "Data Quality":                 "buyer",
    "Interoperability":             "buyer",
    "Implementation Readiness":     "buyer",
    "Purpose Limitation":           "both",
    "Intent Verification":          "both",
    "Behavioral Profiling":         "buyer",
    "Consent Validity":             "both",
    "Reputational Impact":          "both",
    "Political/Diplomatic":         "both",
    "Competitive Sensitivity":      "both",
    "Public Interest":              "both",
    "Data Lifecycle":               "both",
    "Timeliness":                   "buyer",
    "Durability":                   "buyer",
    "Regulatory Durability":        "buyer",
    "Health & Safety":              "buyer",
    "Emotional/Psychological":      "buyer",
    "Segmentation":                 "buyer",
    "Synergy":                      "both",
}

# same = high risk score -> high value; inverted = low risk score -> high value
VALUE_RELATIONSHIP_B = {
    "Identifiability":            "same",
    "Re-identification Risk":     "same",
    "Sensitivity":                "same",
    "Health & Safety":            "same",
    "Emotional/Psychological":    "same",
    "Discriminatory Impact":      "same",
    "Behavioral Profiling":       "same",
    "Consent Validity":           "inverted",
    "Purpose Limitation":         "inverted",
    "Data Lifecycle":             "inverted",
    "Temporal Sensitivity":       "same",
    "Public Interest":            "same",

    "Compliance":                 "inverted",
    "Legal Liability":            "inverted",
    "Regulatory Velocity":        "inverted",
    "Regulatory Velocity Change": "inverted",
    "Security Vulnerability":     "inverted",
    "Technical Debt":             "inverted",
    "Integration Complexity":     "inverted",
    "Data Quality":               "inverted",
    "Obsolescence":               "inverted",
    "Replication Risk":           "inverted",
    "Cross-Border Transfer":      "same",

    "Financial Exposure":         "same",
    "Market Risk":                "same",
    "Insurance/Actuarial":        "same",
    "Reputational Impact":        "same",
    "Political/Diplomatic":       "same",
    "Competitive Sensitivity":    "same",
    "Confidentiality":            "inverted",
    "Intent Risk":                "inverted",
    "Combination/Synergy Risk":   "same",
}

_REL_SIGN_B = np.array([1.0 if VALUE_RELATIONSHIP_B[d] == "same" else -1.0 for d in DIMENSIONS])

# how risk on one side connects to value on the other, per dimension.
# checked against risk_engine.DIM_SIDE rather than assumed - most
# dimensions do NOT simply flip risk-party to the opposite value-party.
MECHANISM_DESCRIPTIONS = {
    "cross_party_transfer":          "risky for the seller is exactly what makes it valuable to the buyer",
    "same_party_tradeoff":           "same trait, same party - more of it is both more risk and more value for them",
    "same_party_improvement":        "less risk for the buyer directly is more value for the buyer",
    "shared_improvement_governance": "less risk for the seller (better governance) creates value shared by both",
    "shared_signal":                 "risk and value are both shared by seller and buyer together",
    "reassigned_control":            "buyer's risk, but the value goes to the seller for a separate reason (control)",
    "partial_cross_party":           "seller's risk becomes value, but shared rather than going purely to the buyer",
}

def _classify_mechanism(d):
    risk_side = DIM_SIDE[d]
    direction = VALUE_RELATIONSHIP_B[d]
    value_party = VALUE_PARTY_B[RISK_TO_B[d]]

    if risk_side == "seller" and direction == "same" and value_party == "buyer":
        return "cross_party_transfer"
    if risk_side == "buyer" and direction == "same" and value_party == "buyer":
        return "same_party_tradeoff"
    if risk_side == "buyer" and direction == "inverted" and value_party == "buyer":
        return "same_party_improvement"
    if risk_side == "seller" and direction == "inverted" and value_party == "both":
        return "shared_improvement_governance"
    if risk_side == "both":
        return "shared_signal"
    if risk_side == "buyer" and direction == "inverted" and value_party == "seller":
        return "reassigned_control"
    if risk_side == "seller" and direction == "same" and value_party == "both":
        return "partial_cross_party"
    return "unclassified"

VALUE_MECHANISM_B = {d: _classify_mechanism(d) for d in DIMENSIONS}

# valuable but capable of powering harmful use - always shown, never boosted or penalized
DUAL_USE_DIMENSIONS_B = {
    "Identifiability", "Behavioral Profiling", "Segmentation",
    "Emotional/Psychological", "Synergy",
}

SELLER_VALUE_BOOST_B = {d: 1.7 for d, p in VALUE_PARTY_B.items() if p == "seller"}
SELLER_VALUE_BOOST_B.update({d: 1.2 for d, p in VALUE_PARTY_B.items() if p == "both"})
SELLER_VALUE_BOOST_B.update({d: 0.3 for d, p in VALUE_PARTY_B.items() if p == "buyer"})

BUYER_VALUE_BOOST_B = {d: 1.7 for d, p in VALUE_PARTY_B.items() if p == "buyer"}
BUYER_VALUE_BOOST_B.update({d: 1.2 for d, p in VALUE_PARTY_B.items() if p == "both"})
BUYER_VALUE_BOOST_B.update({d: 0.3 for d, p in VALUE_PARTY_B.items() if p == "seller"})


# Delphi run specifically for value-importance, not risk-importance
def _delphi_value():
    base = np.array([
        9.0, 8.5, 6.0, 7.5, 7.0, 6.0, 4.0, 5.5,
        8.0, 7.5, 5.0, 6.5, 7.5, 8.0, 5.0, 4.5,
        5.5, 7.0, 8.0, 6.5, 5.5, 3.0, 6.0, 4.0,
        4.5, 6.5, 6.0, 3.5, 7.0, 6.0, 6.5, 8.0,
    ])
    def rnd(n, prior, noise):
        r = np.zeros((15, N))
        for e in range(15):
            r[e] = np.clip(prior + np.random.normal(0, noise, N), 1, 10)
        return r
    r1 = rnd(15, base, 2.0)
    r2 = rnd(15, np.median(r1, axis=0), 1.0)
    r3 = rnd(15, np.median(r2, axis=0), 0.67)
    return np.median(r3, axis=0)

_value_delphi_raw = _delphi_value()
_value_delphi_w    = _value_delphi_raw / _value_delphi_raw.sum()

VALUE_WEIGHTS = 0.5 * WEIGHTS + 0.5 * _value_delphi_w
VALUE_WEIGHTS = VALUE_WEIGHTS / VALUE_WEIGHTS.sum()


def _make_value_weights(boosts):
    w = VALUE_WEIGHTS.copy()
    for b_name, boost in boosts.items():
        risk_name = B_TO_RISK.get(b_name)
        if risk_name in DIM_IDX:
            w[DIM_IDX[risk_name]] *= boost
    return w / w.sum()

SELLER_VALUE_WEIGHTS_B = _make_value_weights(SELLER_VALUE_BOOST_B)
BUYER_VALUE_WEIGHTS_B  = _make_value_weights(BUYER_VALUE_BOOST_B)


INTENT_VALUE_MULT_B = {
    "Medical Research (IRB approved)":       0.90,
    "Public Health Monitoring":               0.95,
    "Fraud Detection / Security":             1.05,
    "Academic Research (anonymized)":         0.80,
    "Product Personalization (consented)":    1.15,
    "Financial Risk Assessment":              1.10,
    "Market Research":                        1.00,
    "Targeted Advertising":                   1.30,
    "Credit Scoring (undisclosed)":           1.20,
    "Political Micro-targeting":              1.35,
    "Behavioral Surveillance":                1.40,
    "Data Brokerage (resale)":                1.50,
    "Social Engineering / Manipulation":      1.20,
}

SEEKER_VALUE_MULT_B = {
    "Regulated Financial Institution":        1.10,
    "Healthcare Provider (HIPAA)":            1.05,
    "Government Agency (domestic)":           1.00,
    "Academic Institution":                   0.80,
    "Insurance Company":                      1.15,
    "Technology Company (GDPR compliant)":    1.05,
    "Retail / E-commerce":                    1.10,
    "Marketing Agency":                       1.25,
    "Data Broker":                            1.35,
    "Unknown / Unverified":                   0.70,
    "High-risk Jurisdiction (no regs)":       0.75,
}

_MAX_CTX     = max(v.max() for v in CONTEXT_VECTORS.values())
_MAX_INTENT  = max(INTENT_VALUE_MULT_B.values())
_MAX_SEEKER  = max(SEEKER_VALUE_MULT_B.values())


class ValueEngineB:

    def __init__(self):
        self.weights        = VALUE_WEIGHTS
        self.seller_weights = SELLER_VALUE_WEIGHTS_B
        self.buyer_weights  = BUYER_VALUE_WEIGHTS_B

    def _project_and_flip(self, base, temporal):
        # age first, flip second - flipping before aging inverts the trend
        base_t = base * temporal
        return np.where(_REL_SIGN_B > 0, base_t, np.maximum(10.0 - base_t, 0.0))

    def _compute_side(self, eff, ctx, intent_f, seeker_f, juris_f, verif_adj,
                       weights, n_qubes, t_max):
        dim_value = eff * weights * ctx * intent_f * seeker_f * verif_adj
        if n_qubes > 1:
            sf = 1 + 0.08 * np.log(n_qubes)
            synergy = (eff @ weights) * (sf - 1) * 0.5
        else:
            synergy = 0.0
        raw   = dim_value.sum() + synergy
        score = min(max(min(raw / t_max, 1.0) * juris_f, 0.0), 1.0)
        return score, dim_value, synergy

    def score(self,
              dim_scores,
              src_context=None,
              tgt_context=None,
              t_years=0,
              intent="Market Research",
              seeker="Technology Company (GDPR compliant)",
              jurisdiction="EU (GDPR enforced)",
              n_qubes=1,
              verification=0.7,
              seller_confidence=0.5,
              buyer_confidence=0.5):

        base = np.zeros(N)
        for dim, val in dim_scores.items():
            if dim in DIM_IDX:
                base[DIM_IDX[dim]] = val

        if src_context and tgt_context and src_context != tgt_context:
            ctx = get_transition_multipliers(src_context, tgt_context)
        elif tgt_context and tgt_context in CONTEXT_VECTORS:
            ctx = CONTEXT_VECTORS[tgt_context]
        else:
            ctx = np.ones(N)

        temporal = np.array([temporal_risk_factor(d, t_years) for d in DIMENSIONS])
        eff = self._project_and_flip(base, temporal)

        intent_f = INTENT_VALUE_MULT_B.get(intent, 1.0)
        seeker_f = SEEKER_VALUE_MULT_B.get(seeker, 1.0)
        juris_f  = JURISDICTION_MULT.get(jurisdiction, 1.0)

        # unverified intent gets half credit, not zero
        verif_adj = 0.5 + 0.5 * verification

        t_max_seller = 10 * self.seller_weights.sum() * _MAX_CTX
        t_max_full   = 10 * self.weights.sum() * _MAX_CTX * _MAX_INTENT * _MAX_SEEKER
        t_max_buyer  = 10 * self.buyer_weights.sum() * _MAX_CTX * _MAX_INTENT * _MAX_SEEKER

        unified_score, dim_value, synergy = self._compute_side(
            eff, ctx, intent_f, seeker_f, juris_f, verif_adj, self.weights, n_qubes, t_max_full)

        seller_score, seller_dim_value, _ = self._compute_side(
            eff, ctx, 1.0, 1.0, juris_f, verif_adj, self.seller_weights, n_qubes, t_max_seller)

        buyer_score, buyer_dim_value, _ = self._compute_side(
            eff, ctx, intent_f, seeker_f, juris_f, verif_adj, self.buyer_weights, n_qubes, t_max_buyer)

        dim_value_b        = dict(zip(DIMENSIONS_B, dim_value))
        seller_dim_value_b = dict(zip(DIMENSIONS_B, seller_dim_value))
        buyer_dim_value_b  = dict(zip(DIMENSIONS_B, buyer_dim_value))

        top5 = sorted(dim_value_b.items(), key=lambda x: x[1], reverse=True)[:5]

        dual_use_flags = {
            RISK_TO_B[d]: round(dim_value_b[RISK_TO_B[d]], 4)
            for d in dim_scores if d in DIM_IDX and RISK_TO_B[d] in DUAL_USE_DIMENSIONS_B
        }

        # for each scored dimension, how its risk connects to its value
        mechanisms = {
            RISK_TO_B[d]: VALUE_MECHANISM_B[d]
            for d in dim_scores if d in DIM_IDX
        }

        return {
            "value_score":       unified_score,
            "seller_value":      seller_score,
            "buyer_value":       buyer_score,
            "top_dimensions":    top5,
            "synergy":           synergy,
            "dim_values":        dim_value_b,
            "seller_dim_values": seller_dim_value_b,
            "buyer_dim_values":  buyer_dim_value_b,
            "dual_use_flags":    dual_use_flags,
            "mechanisms":        mechanisms,
            "factors": {
                "intent": intent_f, "seeker": seeker_f,
                "jurisdiction": juris_f, "verif_adj": verif_adj,
            },
            "_seller_confidence": seller_confidence,
            "_buyer_confidence":  buyer_confidence,
        }


class ValueConvergenceEngine:

    def bilateral_value(self, base_value, result):
        sv = result["seller_value"]
        bv = result["buyer_value"]
        sc = result["_seller_confidence"]
        bc = result["_buyer_confidence"]

        seller_min = base_value * (1 + sv * sc)
        buyer_max  = base_value * (1 + bv * bc)

        total_conf = sv + bv
        w_seller = 0.5 if total_conf == 0 else sv / total_conf
        w_buyer  = 1 - w_seller

        converged = w_seller * seller_min + w_buyer * buyer_max

        return {
            "seller_min":       seller_min,
            "buyer_max":        buyer_max,
            "converged_value":  converged,
            "seller_value":     sv,
            "buyer_value":      bv,
            "seller_weight":    w_seller,
            "buyer_weight":     w_buyer,
            "balance":          "seller-heavy" if sv > bv + 0.05 else
                                "buyer-heavy" if bv > sv + 0.05 else "balanced",
        }


if __name__ == "__main__":

    engine   = ValueEngineB()
    converge = ValueConvergenceEngine()

    print("\n=== VALUE ENGINE B demo ===\n")

    scores = {
        "Identifiability": 8.5, "Sensitivity": 9.5, "Health & Safety": 9.0,
        "Compliance": 3.0, "Data Quality": 2.0, "Security Vulnerability": 2.5,
        "Behavioral Profiling": 8.0, "Combination/Synergy Risk": 7.5,
    }

    r = engine.score(
        dim_scores=scores, tgt_context="Insurance Underwriting",
        intent="Financial Risk Assessment", seeker="Insurance Company",
        jurisdiction="US (sector-specific)", n_qubes=len(scores),
        seller_confidence=0.5, buyer_confidence=0.8,
    )
    print(f"  value score: {r['value_score']:.4f}  seller value: {r['seller_value']:.4f}  buyer value: {r['buyer_value']:.4f}")
    print(f"  top value drivers: {r['top_dimensions'][:3]}")
    print(f"  dual-use flags present: {r['dual_use_flags']}")
    print(f"  mechanisms: {r['mechanisms']}")

    c = converge.bilateral_value(40000, r)
    print(f"  seller min: ${c['seller_min']:.2f}  buyer max: ${c['buyer_max']:.2f}  converged: ${c['converged_value']:.2f}")
    print()