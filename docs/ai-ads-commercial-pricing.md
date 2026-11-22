# AI Ads commercial pricing

## Price list

Prices below are NGN before VAT. The Next catalogue inherits the currently configured central tax rate and adds it at checkout.

| Tier | Monthly | Annual | Copy suggestions / month | AI images / month | AI videos / month | Storage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | ₦10,200 | ₦107,400 | 20 | 2 | 1 | 100 MB |
| Growth | ₦27,600 | ₦292,200 | 60 | 8 | 3 | 500 MB |
| Scale | ₦71,100 | ₦754,200 | 200 | 25 | 8 | 2,048 MB |

Each generated-video allowance covers one clip up to 10 seconds at 720p. A clip made from a merchant's uploaded photo or video consumes the same allowance as a clip created from a text description. Uploaded campaign media counts toward the plan's storage capacity. Monthly allowances reset monthly for both billing terms. Annual pricing gives two months free on the software portion while retaining 12 months of video-generation credits.

## Video cost and margin assumption

Google's published Gemini Omni rate is about $0.10 per second for 720p video. The pricing model uses a conservative internal FX budget of ₦1,450/USD, producing an estimated provider cost of ₦1,450 per 10-second clip. The included video allocation is ₦2,700 per clip. After reserving Paystack's 1.5% local fee and its ₦100 fixed fee against every clip, contribution is about ₦1,110 per clip, or about 41.1% of the allocation. This is before storage, support, retries, and the other AI features. VAT is added separately and is not counted as revenue.

This is a minimum video-cost margin model, not a full company gross-margin forecast. The text/image provider rates and actual FX settlement must be measured before claiming a 40% margin across every plan component. Annual prices charge 10 software months plus 12 months of video allocations. Add-on overage billing is not available; customers are capped at their included allowance.

## Release state

Migrations `199_ai_ads_video_pricing.sql` and `200_ai_ads_video_cost_repricing.sql` stage these prices in Next's catalogue and leave all six monthly/annual offers disabled. Migration 200 also corrects the earlier lower video-cost assumption. Migration 201 removes the separately priced export quota so all AI video paths share the priced cap. The AI media generation API, private asset storage, usage accounting, and enforcement must be released and exercised against production providers before an administrator enables offers and selects **Save and publish prices**. That action synchronizes the signed catalogue to Central; Central then supplies the offers to Fleet. Existing paid subscriptions are not changed by these migrations.

## Provider placement and readiness

Provider keys and generation requests belong in Next Admin's server environment. Fleet must never hold OpenAI or Google credentials, and Central should broker authenticated requests and subscription state without relaying provider secrets. Use OpenAI for copy and campaign image generation, and Gemini Omni for video generation. The signed billing health route requires both provider keys and `AI_ADS_CREATIVE_ENABLED=true` before it reports offers as purchasable. Keep the release flag off until the deployed API paths have been exercised against the production provider accounts.
