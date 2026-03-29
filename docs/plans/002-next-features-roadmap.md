# Plan: Next Features Roadmap
**Date:** 2026-03-29 | **Status:** active

## High Impact — Makes it feel like a real product
1. **Deploy to production** — Put marketplace + API live on the internet so you can share the URL
2. **Landing page** — Marketing homepage explaining Problocks before the marketplace
3. **Classroom UI** — Frontend for the classroom API (educator dashboard, student view, assignment tracking)
4. **SDK documentation site** — So students know what API is available when vibecoding

## Medium Impact — More content & features
5. **More simulation modules** — `@problocks/mechanics` (gears, springs), `@problocks/chemistry` (molecules)
6. **More CLI templates** — engineering, biology, math templates for `problocks init`
7. **Economy API** — Virtual currency, Stripe connect for creator payouts
8. **Real-time multiplayer** — WebSocket server for collaborative simulations

## Polish & Quality
9. **Studio interactivity** — Click entities in viewport to select, drag gizmos to move/rotate
10. **Mobile responsive** — Marketplace works on phones
11. **Tests** — Unit tests for engine, circuits module, API endpoints
12. **Thumbnail generation** — Auto-screenshot simulations for marketplace cards
13. **Version diff viewer** — Compare simulation versions side-by-side

## Infrastructure
14. **CI/CD pipeline** — GitHub Actions for build/test/deploy
15. **Security hardening** — Rate limiting, input validation, CORS lockdown
16. **PostgreSQL migration** — Move from SQLite for production scale
