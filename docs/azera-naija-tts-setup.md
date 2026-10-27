# Azera Nigerian-language campaign voice

Azera can use Naija Speech to generate personalized campaign audio in Nigerian English, Hausa, Igbo, or Yoruba. Africa's Talking still places the phone call and plays the generated MP3; its call charges are separate from speech generation.

## Vercel configuration

Per your confirmation, the API key you obtained is cleared for commercial use and has no additional pricing or usage limits. Add this server-side Vercel environment variable (Production and Preview only if appropriate):

- `NAIJA_TTS_API_KEY` — the API key; never expose it with a `NEXT_PUBLIC_` prefix.

Redeploy after setting it. The Admin → Azera → Call Campaigns screen will then enable Naija Speech and the supported languages/voices. Without the API key, Africa's Talking's existing English speech remains available and Naija Speech campaigns cannot start.

## Languages

- Nigerian English: voice IDs such as `idera`, `emma`, `jude`, `tayo`, and others.
- Hausa: `hausa_*` voices.
- Igbo: `igbo_*` voices.
- Yoruba: `yoruba_*` voices.

The campaign opening is generated using the configured AI text provider, then synthesized by the selected speech voice. Review each opening before starting a campaign. Generated personalized audio is stored in a private Supabase bucket, served to Africa's Talking with a one-hour signed URL, and removed after the call's response/timeout callback.

The application enforces the provider's documented 1,000-character request limit. Your key/account terms take precedence for commercial eligibility and quota; verify those terms with the provider if they change.
