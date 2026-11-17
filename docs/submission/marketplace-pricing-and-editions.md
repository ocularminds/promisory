# Marketplace pricing and editions

Decision updated 17 November 2026 from the owner’s latest pricing recommendation.

| User band | Monthly price in USD |
|---|---:|
| 1–10 | $10 flat |
| 11–100 | $4.90 per user |
| 101–250 | $3.20 per user in this band |
| 251–1,000 | $2.00 per user in this band |
| Above 1,000 | $1.10 per user in this band |

The Marketplace form applies progressive monthly bands above ten users. A 1,000-user site totals $2,470/month and its corresponding annual tier is $24,700. Annual tiers are calculated by Atlassian at ten times the monthly tier total. The same rates were entered for single-instance and multi-instance pricing; multi-instance billing is annual. The standard trial remains the intended offer. These are Jira user prices, not Decionis action-pack quotas.

## Revenue share

The [current Atlassian rules](https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/) expressly allow Forge Remote apps to qualify for Forge revenue rates when they contain no Connect modules/scopes, use OAuth and use Forge UI. Promisory meets those technical conditions. The partner-wide first $1 million of lifetime Forge revenue receives the 0% Atlassian share from 1 January 2026. Decionis’s remaining allowance has not been verified. Above that allowance, the current Forge share is 17%, so $4.90 yields $4.067 before other costs, discounts, refunds and tax effects. The Runs on Atlassian badge is a separate eligibility test.

Price edits become effective after 24 hours. Existing customers may use the lower price during the documented 60-day override, subject to the same user tier and quote timing.

## Editions eligibility and implementation

[Forge editions](https://developer.atlassian.com/platform/marketplace/app-editions-forge-apps/) are supported for existing Paid via Atlassian cloud apps. Promisory’s framework/payment model qualify in principle. The current Marketplace profile has ordinary active-license checks, but no Standard/Advanced entitlement gates and no editions-enabled manifest. No Editions tab was available when preparing the listing; the submitted listing is now locked pending review. Do not advertise an Advanced edition as purchasable yet.

Proposed Standard features: change notices, PRD candidates, ledger, Rovo and read-only MCP. Proposed Advanced features: governed Jira date changes, slip-budget enforcement and Decionis authorization. The owner suggested $7–8 for Advanced; a complete Advanced price schedule has not been fixed.

Before enabling editions: implement trusted backend capability-set checks (not browser-only gates); retain the full authorized development/judge test profiles; test active, inactive, Standard, Advanced and missing-entitlement states; add the documented editions manifest field; deploy; then map features and submit the separate [edition review](https://developer.atlassian.com/platform/marketplace/publishing-app-editions/). Preserve existing customer entitlements when classifying features. The draft slip-budget policy still needs its separate release and approval.
