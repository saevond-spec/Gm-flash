import test from "node:test";
import assert from "node:assert/strict";
import {normalizePostingBudget} from "../worker.mjs";
const cases=[
  [
    {
      "budget_cents": 2500,
      "currency": "USD"
    },
    2500,
    "explicit_usd"
  ],
  [
    {
      "posting_budget_cents": "2500",
      "currency": "USD"
    },
    2500,
    "explicit_usd"
  ],
  [
    {
      "budget_usd": "25.01"
    },
    2501,
    "explicit_usd"
  ],
  [
    {
      "posting_budget_usd": 25.5,
      "currency": "USD"
    },
    2550,
    "explicit_usd"
  ],
  [
    {
      "budget_cents": 2500,
      "budget_usd": "25.00"
    },
    2500,
    "explicit_usd"
  ],
  [
    {
      "budget_cents": 2500,
      "budget_usd": "25.01"
    },
    null,
    "conflicting_budget"
  ],
  [
    {
      "budget_cents": 2500,
      "currency": "EUR"
    },
    null,
    "unsupported_currency"
  ],
  [
    {
      "escrow_amount": 25,
      "currency": "USD"
    },
    null,
    "missing"
  ],
  [
    {
      "budget": 25,
      "currency": "USD"
    },
    null,
    "missing"
  ],
  [
    {
      "amount_cents": 2500,
      "currency": "USD"
    },
    null,
    "missing"
  ],
  [
    {
      "budget_usd": "25.001"
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_usd": "1e3"
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_cents": 2.5
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_cents": -1
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_cents": 0
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_cents": 2500
    },
    2500,
    "explicit_cents_currency_unknown"
  ],
  [
    {
      "budget_cents": "02500"
    },
    null,
    "invalid_explicit_budget"
  ],
  [
    {
      "budget_usd": "0.01"
    },
    1,
    "explicit_usd"
  ]
];
for(const [i,[input,cents,state]] of cases.entries())test("budget normalization "+(i+1),()=>assert.deepEqual(normalizePostingBudget(input),{cents,state}));
