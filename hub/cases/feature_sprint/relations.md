---
hub: "1.0"
kind: relations
case: feature_sprint
---

@ux >read @feedback_sample
@arch >read @spec
@arch >read @tech_constraints
@impl_a >read @api_contract
@impl_b >read @api_contract
@qa >read @api_contract
@qa >read @test_cases
@qa >read @feedback_sample
@reviewer >read @api_contract
@reviewer >read @tech_constraints
@n3 >read @test_report
@n3 >read @review_notes
@n3 >read @spec
