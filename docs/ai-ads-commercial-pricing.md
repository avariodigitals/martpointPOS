# AI Ads commercial pricing

## Customer offers

Prices are NGN before VAT. The Next catalogue sources the Central tax rate and adds it at checkout. Meta bills ad spend directly to the merchant's advertising account.

| Tier | Monthly | Annual | Copy suggestions / month | AI images / month | Finished AI video ads / month | Storage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | ₦10,200 | ₦107,400 | 20 | 2 | 1 | 100 MB |
| Growth | ₦27,600 | ₦292,200 | 60 | 8 | 3 | 500 MB |
| Scale | ₦71,100 | ₦754,200 | 200 | 25 | 8 | 2,048 MB |

One video allowance means one finished 13-second vertical ad: three generated scenes of 4, 5, and 4 seconds, AI voiceover, and composited captions. A merchant photo can be used as a visual reference. Merchant-uploaded video can be attached to campaign drafts, but is not an input to the first generated-scene flow. Annual offers renew manually and receive a fresh monthly allowance in each plan month; unused allowances do not roll over.

## Video cost assumption

The planning model uses a conservative internal exchange budget of ₦1,450/USD and an estimated Gemini Omni rate of $0.10 per generated second at 720p. At 13 seconds, that is about ₦1,885 for the three video scenes. A ₦3,400 video allocation leaves about ₦3,249 after the modeled 1.5% Paystack fee and ₦100 fixed fee; the remaining contribution is about 42% of net receipts before TTS, director prompts, FX settlement, storage, support, retries, and other operating costs.

This estimate is not a verified all-in 40% gross margin. Measure actual provider use and payment settlement before enabling customer checkout. Plan capacities and prices are staged with the offers disabled, and retries must not bypass the per-month finished-video allowance.

## Release state

Migrations 199–201 stage the six monthly and annual offers disabled. Migration 201 also sets the legacy separate export entitlement to zero so video generated from a prompt or merchant photo uses the same finished-video cap. Keep offers and `AI_ADS_CREATIVE_ENABLED` disabled until all provider calls, media rendering, storage, metering, and campaign controls are available and verified in the deployed environment.

The media route now needs a working FFmpeg executable and a bold sans-serif font file. Set `AI_ADS_FFMPEG_PATH` and `AI_ADS_FONT_PATH` in the Next server environment; the signed health response reports renderer readiness and keeps checkout unavailable until both work. It uses OpenAI for TTS and Gemini Interactions for direction and video generation. Keys remain server-side in Next Admin.

## Campaign launch controls

Fleet now prepares Meta campaigns, ad sets and creatives in a paused state. It activates them only after an authenticated Fleet user explicitly approves the displayed NGN lifetime budget. Website Sales campaigns require the selected account's Pixel and conversion event. WhatsApp destinations use a traffic campaign with a WhatsApp message CTA. The Fleet can pause an active campaign and display the latest seven-day impressions, clicks and spend; conversion events are shown when Meta returns them. Meta permission/app-review state and account-specific asset eligibility still need to be confirmed against the live business account before offers or campaign publishing are released.
