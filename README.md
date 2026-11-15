# Aahana AI

Aahana is a standalone general-purpose AI assistant product. It is separate from BuTTi, BANDI and Savora.

## Stack
- Next.js App Router
- Supabase for authentication and persisted user data
- Vercel for hosting and AI Gateway
- Vercel AI SDK for streaming model interactions

## Local setup
1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project values.
4. Run `npm run dev`.

## Release gates
- AI generation remains disabled until the model route is implemented and tested end-to-end.
- Never commit secrets or service-role keys.
- All user-owned data access must be protected by Supabase RLS and server-side ownership checks.
- Keep Vercel deployment protection enabled until launch approval.
- Do not claim reminders, file generation, image/video generation, or external actions are available until each capability is implemented and verified.

## Product modes
Solve · Create · Write · Build · Improve
