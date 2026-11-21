import test from "node:test";
import assert from "node:assert/strict";
import {reconcileBudgetEvidence} from "../worker.mjs";
const cases=[
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "listing_price_review",
    2500
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "explicit_usd",
      "cents": 2500
    },
    "detail_explicit",
    2500
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 3000
      }
    ],
    {
      "state": "explicit_usd",
      "cents": 2500
    },
    "cross_source_conflict",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      },
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 3000
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "cross_source_conflict",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "2",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "EUR",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "closed",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": true,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "conflicting_budget",
      "cents": null
    },
    "detail_conflict",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "conflicting_budget",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "listing_conflict",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "EUR"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 2,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "closed",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 0
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_cents_currency_unknown",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [],
    {
      "state": "missing",
      "cents": null
    },
    "unavailable",
    null
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [],
    {
      "state": "explicit_usd",
      "cents": 2500
    },
    "detail_explicit",
    2500
  ],
  [
    {
      "id": 1,
      "status": "bidding",
      "currency": "USD"
    },
    "1",
    [
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      },
      {
        "problem_id": "1",
        "currency": "USD",
        "status": "bidding",
        "simulated_flag": false,
        "budget_evidence_state": "explicit_usd",
        "budget_cents": 2500
      }
    ],
    {
      "state": "missing",
      "cents": null
    },
    "listing_price_review",
    2500
  ]
];
for(const [i,[task,id,evidence,detail,state,cents]] of cases.entries())test("cross-source price "+(i+1),()=>assert.deepEqual(reconcileBudgetEvidence(task,id,evidence,detail),{state,cents}));
