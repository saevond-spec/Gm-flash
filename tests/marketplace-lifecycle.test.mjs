import test from "node:test";
import assert from "node:assert/strict";
import {nextMarketplaceAction} from "../marketplace-lifecycle.mjs";
const cases=[
  [
    {},
    "verify_identity"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000
    },
    "bid"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": false,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000
    },
    "browse_and_qualify"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 499,
      "platformLimitCents": 100000
    },
    "browse_and_qualify"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": false,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000
    },
    "browse_and_qualify"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "claimAllowed": true,
      "claimContractVerified": false
    },
    "bid"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "claimAllowed": true,
      "claimContractVerified": true
    },
    "claim"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "bidUncertain": true
    },
    "reconcile_receipt"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "bidConfirmed": true
    },
    "monitor_assignment"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": false
    },
    "verify_assignment"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "assignmentAcceptanceRequired": true
    },
    "verify_accept_contract"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "assignmentAcceptanceRequired": true,
      "acceptContractVerified": true
    },
    "accept_assignment"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true
    },
    "solve_in_isolated_environment"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "deliverableVerified": true
    },
    "solve_in_isolated_environment"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "deliverableVerified": true,
      "evidenceVerified": true
    },
    "submit_solution"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "submissionUncertain": true
    },
    "reconcile_receipt"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "deliverySubmitted": true
    },
    "monitor_review"
  ],
  [
    {
      "identityVerified": true,
      "open": true,
      "paidUsd": true,
      "scopeVerified": true,
      "isolatedEnvironmentVerified": true,
      "costCents": 0,
      "quoteCents": 2500,
      "platformLimitCents": 100000,
      "assignedToSprite": true,
      "fundingVerified": true,
      "deliveryAccepted": true
    },
    "track_settlement"
  ]
];
cases.push([{identityVerified:true,open:true,paidUsd:true,scopeVerified:true,isolatedEnvironmentVerified:true,costCents:0,quoteCents:500,platformLimitCents:100000},"bid"]);
for(const [i,[input,expected]] of cases.entries())test("lifecycle case "+(i+1)+" "+expected,()=>assert.equal(nextMarketplaceAction(input),expected));
