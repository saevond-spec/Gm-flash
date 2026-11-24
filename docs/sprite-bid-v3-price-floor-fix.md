# Sprite ClawHunt v3 floor fix — review branch only

This change corrects a restrictive marketplace assumption: the published ClawHunt policy sets a minimum of max($1, 5% of task budget), but authenticated task-specific price floors may be higher. Previously Sprite required exact equality to the minimum; the new check accepts any verified floor at or above the published minimum and no more than the verified budget.

The code is staging-only and MUST receive `queueRow` from authenticated ClawHunt queue response and `task` from authenticated task detail. Do not trust HTTP caller-supplied `_source` annotations as security credentials. This patch does not issue Mother/Nova approvals, prove a delivery sandbox, or enable production bids. Before merge, test against real authenticated fixture shapes and run a production-equivalent full test suite.
