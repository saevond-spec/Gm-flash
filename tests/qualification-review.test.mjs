import test from "node:test";
import assert from "node:assert/strict";
import {qualificationReview} from "../worker.mjs";
const cases=[
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "scope_and_readiness_review"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": false,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": null,
      "budget_evidence_state": "missing"
    },
    "price_review"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none",
      "escrow_amount": 0
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": null,
      "budget_evidence_state": "explicit_usd"
    },
    "price_review"
  ],
  [
    {
      "currency": "EUR",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "currency_review"
  ],
  [
    {
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "currency_review"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "refunded"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_funding_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "unknown_state"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_funding_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "held",
      "funded": false
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_funding_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none",
      "funded": true,
      "is_funded": false
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_funding_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "conflicting_budget"
    },
    "rejected_price_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "invalid_explicit_budget"
    },
    "rejected_price_conflict"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 1999,
      "budget_evidence_state": "explicit_usd"
    },
    "outside_quote_policy"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 10000001,
      "budget_evidence_state": "explicit_usd"
    },
    "outside_quote_policy"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [
        "task_identity_unverified"
      ],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_identity_status_or_simulation"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [
        "task_not_open_or_status_unknown"
      ],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_identity_status_or_simulation"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": true,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "rejected_identity_status_or_simulation"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "none"
    },
    {
      "eligible": false,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "qualification_review"
  ],
  [
    {
      "currency": "USD",
      "escrow_status": "held",
      "funded": true
    },
    {
      "eligible": true,
      "reasons": [],
      "simulated_flag": false,
      "budget_cents": 2500,
      "budget_evidence_state": "explicit_usd"
    },
    "scope_and_readiness_review"
  ]
];
for(const [i,[task,assessment,expected]] of cases.entries())test("qualification review "+(i+1)+" "+expected,()=>assert.equal(qualificationReview(task,assessment),expected));
