# Aahana AI

Aahana is a standalone general-purpose AI assistant product. It is separate from BuTTi, BANDI and Savora.

## Stack
- Next.js App Router
- Supabase for authentication and persisted user data
- Vercel for hosting and AI Gateway
- Server-side streaming chat through the Vercel AI Gateway-compatible endpoint

## Local setup
1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project values.
4. Run `npm run dev`.

## Production checks
- Production URL: https://aahana-ai.vercel.app
- AI generation is feature-flagged by `AAHANA_AI_ENABLED=true` and requires a working Vercel OIDC token plus `AAHANA_MODEL`.
- The production deployment can build successfully while the authenticated AI request path is still unverified. Verify a signed-in prompt end-to-end before describing AI generation as operational.
- Signup email delivery depends on valid transactional SMTP settings in Supabase Auth. Keep email confirmation enabled; never put SMTP credentials in source control.
- Do not commit secrets or service-role keys.
- All user-owned data access must be protected by Supabase RLS and server-side ownership checks.
- Do not claim reminders, file understanding, file generation, image/video generation, app deployment, or external actions are available until each capability is implemented and verified.

## Current workspace capabilities
- Private user accounts and sign-in
- Conversation history and project workspaces
- Private file upload and storage metadata
- Five assistant modes: Solve, Create, Write, Build and Improve
- Daily AI request quota enforcement
- Offline arithmetic fallback for supported expressions when AI service calls fail

## Product modes
Solve · Create · Write · Build · Improve
