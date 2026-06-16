# Reference Capture Log — Public (Unauthenticated) Surface

Spike: Reference-Parity Gap Analysis
Agent scope: PUBLIC surface of the reference (`http://localhost:3000/`), session `refpub`.
Captured: 2026-06-16. Reference build: "Track My Money" (Next.js, dev server).
Target dir: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/`

Both viewports captured per screen: desktop `1440x900`, mobile `390x844`.

## Public route map (verified live)

| Route | Page | Notes |
|---|---|---|
| `/` | Landing (single page) | Hero + Advantages + Reviews + FAQ + Footer, all on one scroll |
| `/sign-up` | Sign Up | email + password, Google/GitHub OAuth, link to sign-in |
| `/sign-in` | Sign In | email + password, Google/GitHub OAuth, link to sign-up |
| `/verify-email` | "Check your email" | static info page, "Back to Sign In" link |
| `/privacy-policy`, `/terms-of-service`, `/contact` | footer links | not in capture scope (out of brief's screen list) |
| any unknown path | redirects to `/sign-in` | no public 404 page reachable (see below) |

No top navigation/header bar on the landing page. No theme toggle and no locale switcher anywhere on the public surface; `color-scheme: light` is fixed (light-theme only). OAuth buttons (Google, GitHub) are present on both auth screens.

## Screenshots produced (this agent)

### Landing `/`
- `landing--hero--desktop.png` — hero (headline, subhead, Get Started / Learn More) + advantages cards visible below
- `landing--hero--mobile.png`
- `landing--advantages--desktop.png` — "Why Track My Money?" 4 cards (Smart Tracking, Budget Planning, Financial Insights, Recurring Transactions)
- `landing--advantages--mobile.png`
- `landing--reviews--desktop.png` — "What Our Users Say" 3 testimonial cards
- `landing--reviews--mobile.png`
- `landing--faq--desktop.png` — "Frequently Asked Questions" 5-item accordion (collapsed) + footer in same frame
- `landing--faq--mobile.png`
- `landing--footer--desktop.png` — byte-identical to faq--desktop (page max-scroll reached; footer shares the FAQ frame)
- `landing--footer--mobile.png` — byte-identical to faq--mobile (same reason)
- `landing--faq-click-noop--desktop.png` — EVIDENCE: FAQ accordion after clicking a question; panel did NOT expand (see UX defect below)

### Auth
- `auth--sign-up--desktop.png`
- `auth--sign-up--mobile.png`
- `auth--sign-in--desktop.png`
- `auth--sign-in--mobile.png`
- `auth--verify-email--desktop.png`
- `auth--verify-email--mobile.png`

(Note: `auth--email-verified--desktop.png` and `auth--sign-up-filled--desktop.png` in the same dir were produced by the auth/onboarding agent, not this one.)

404: not captured. Every unknown route (`/this-page-does-not-exist`, `/en/zzz-...`) redirects to `/sign-in` via middleware auth-gating, so no public 404/error page is reachable from the browser. `misc--404` intentionally omitted.

## Per-screen quality notes

**Landing — Hero (desktop):** Centered hero, lots of vertical whitespace; headline well-sized but the section feels empty — no hero image, illustration, screenshot, or product preview. No header/nav. Two CTAs (filled purple "Get Started", outline "Learn More"). Functional but visually sparse; reads like a template, not a polished marketing page.

**Landing — Advantages:** Four equal cards with emoji icons (📊 💰 📈 🔄) as the only visual. Emoji-as-iconography looks unpolished/inconsistent vs. a real icon set. Cards have light tinted background, subtle border, consistent spacing. Acceptable layout; low visual sophistication.

**Landing — Reviews:** Three testimonial cards, italic quote + name + role. Clean, consistent. Generic but fine.

**Landing — FAQ:** 5-item accordion with ▼ chevrons. **UX DEFECT (confirmed): the accordion does not expand.** Clicking a question (via UI click and via direct JS `.click()`) leaves `aria-expanded="false"` and reveals no answer text — the FAQ is effectively decorative/non-functional. Answers are never shown to the user. High-signal item for the UI/UX delta backlog.

**Landing — Footer:** Simple footer: Privacy Policy / Terms of Service / Contact Us links + copyright. Minimal, adequate.

**Landing — Mobile:** Sections stack to single column correctly (advantages/reviews cards go 1-up). Responsive layout works. Hero retains large top whitespace on mobile.

**Sign Up / Sign In:** Centered card, light purple tint. **Redundant helper text:** each field shows the same string as BOTH the input placeholder AND a description paragraph below it ("Enter your email" appears twice). Looks unfinished — likely leftover form-field defaults. No "forgot password" link on sign-in. OAuth buttons present. On mobile the card sits low with heavy top whitespace (not vertically balanced).

**Verify Email:** Static "Check your email" card with copy + "Back to Sign In" link. No resend button, no email shown, no auto-poll indication. Minimal but serviceable.

## Top UI/UX observations (feed the backlog UI-delta section)

1. **FAQ accordion is non-functional** — questions don't expand; answers unreachable. (Defect)
2. **Duplicate field helper text on auth forms** — placeholder + description paragraph both say "Enter your email/password". Looks unfinished.
3. **Emoji used as advantage-card icons** — low-polish; a proper icon set would read as more professional.
4. **Hero is sparse** — no imagery/product preview, large empty whitespace; weak marketing impact. No header/nav on landing.
5. **Light theme only on public surface** — no dark mode, no theme toggle, no locale switcher; `color-scheme` fixed to light.
6. **No public 404/error page** — unknown routes silently redirect to `/sign-in` rather than a branded not-found page.
7. **Mobile vertical balance** — auth cards and hero sit low with excessive top whitespace on 390px; not centered/optimized for mobile-first despite the spike's mobile-first parity bar.
8. **Overall**: the public surface is functional and responsive but template-grade; reaching "UI/UX at least as good as the reference" is a low bar here — supertool can plausibly exceed it. The reference's bugs (FAQ, dup helper text) should NOT be replicated.
