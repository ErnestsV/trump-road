# Trump Road (Demo)

Trump Road is a demo gambling-style lane game inspired by Chicken Road, built with Next.js and canvas-based rendering. Move forward across lanes, avoid getting shot down, and cash out at any time.

![Trump Road preview](./public/preview.png)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Live Demo

The app is deployed on Vercel: https://trump-road.vercel.app/

## Possible Improvements

- Move game rules and round state out of `app/game/page.tsx` into a dedicated hook or reducer, for example `useGameRound`.
  Current cost: the route owns bet validation, balance updates, difficulty changes, hazard generation, reset timing, win/loss state, and UI wiring in one component, so every gameplay change requires reading a large mixed UI/state file.
  Benefit: gameplay logic would be easier to test, easier to reason about, and safer to change without accidentally affecting page markup.

- Share game domain types and constants from a dedicated module, for example `app/game/lib/gameConfig.ts`.
  Current cost: values such as `DifficultyKey`, road counts, bet limits, difficulty presets, and payout generation live inside the route, which makes reuse harder and encourages future duplication.
  Benefit: components, hooks, tests, and canvas helpers could import one source of truth for game configuration.

- Split the canvas renderer into smaller drawing helpers.
  Current cost: `GameCanvas.tsx` has a single large render loop that handles layout, camera movement, roads, bullets, walls, player sprites, crash state, and win overlays, so visual changes are harder to isolate.
  Benefit: helpers such as `drawRoads`, `drawPlayer`, `drawHazards`, and `drawWinOverlay` would make the renderer easier to debug and extend while keeping the animation loop stable.

- Add focused tests for pure gameplay logic.
  Current cost: multiplier generation, bet clamping, loss chance calculation, cashout behavior, and round resets can regress without warning because they are only exercised manually in the browser.
  Benefit: small unit tests would catch the highest-risk game behavior quickly without needing to render the full Next.js page.

- Add a lightweight smoke test for the `/game` route.
  Current cost: layout or wiring regressions in the main flow, such as Play/Go/Cash out becoming unusable, may only be noticed after deploying or manual testing.
  Benefit: a browser-level test that opens `/game`, interacts with the controls, and confirms the canvas remains visible would protect the core user journey.

- Centralize asset loading and metadata.
  Current cost: canvas sprites are manually created in `canvasSprites.ts`, so adding or renaming image files requires touching repetitive loading code and missing assets are only noticed visually.
  Benefit: a manifest-style asset module would make sprite additions, paths, expected dimensions, and fallback handling easier to manage.

- Consider moving game-specific styles closer to components if `game.css` keeps growing.
  Current cost: the stylesheet is still manageable, but all route, header, panel, and canvas-adjacent styles currently share one file, increasing the chance that unrelated visual edits affect each other later.
  Benefit: splitting styles by component or section would make future UI changes more localized while preserving the existing visual design.

### Gameplay Balance

- Revisit the loss chance formula before treating the game as balanced.
  Current cost: the current loss chance increases with both difficulty and bet size, which can make higher-stakes rounds feel almost impossible to win and may make the game feel unfair rather than risky.
  Benefit: balancing expected value, win frequency, multiplier growth, and difficulty curves would make the game easier to tune and explain to players.

### Visual and Audio Polish

- Improve the road rendering with more visual detail.
  Current cost: the road is currently a flat canvas fill with lane dividers, so the game scene can feel less polished than the character and object sprites.
  Benefit: adding texture, asphalt variation, lighting, road markings, and small environmental details would make the game feel more complete.

- Rework the sidewalk asset or draw it directly in canvas.
  Current cost: the sidewalk image can look stretched because it is scaled to fill responsive layout space.
  Benefit: a higher-resolution/tileable asset or canvas-drawn sidewalk pattern would keep the edge of the road sharper and more consistent across screen sizes.

- Improve the losing animation.
  Current cost: the current crash/lost state communicates the result, but the transition could feel more dramatic and responsive.
  Benefit: adding staged hit effects, recoil, camera shake, particles, stronger bullet impact timing, and smoother character fall/defeat animation would make losses feel clearer and more satisfying.

- Add sound effects with mute controls.
  Current cost: movement, cashout, win, loss, bullets, and UI actions have no audio feedback, so the game relies only on visuals.
  Benefit: short sound effects would make the game feel more reactive, while a mute toggle and persisted preference would keep it usable in quiet environments.

### Production Readiness

If this demo were considered for a real-money production launch, it would need jurisdiction-specific legal and compliance review first. A possible plan would include:

- Add backend persistence for users, balances, bets, wins/losses, deposits, withdrawals, and audit logs.
- Add authentication with email/password and SSO options such as Google login.
- Add a database-backed wallet so balance changes are server-authoritative instead of client-side state.
- Add age verification, identity verification, duplicate-account checks, and jurisdiction/location restrictions.
- Add responsible gambling features such as deposit limits, time-outs, self-exclusion, reality checks, responsible gambling information, and risky-play monitoring.
- Add legal and consent flows, including Terms of Use, Privacy Policy, Cookie Policy, responsible gambling page, eligibility notice, cookie consent, and terms acceptance before play.
- Integrate a payment provider that explicitly supports regulated gambling, including deposits, withdrawals, refunds, chargebacks, and transaction audit trails.
- Add account pages where players can review balance, deposits, withdrawals, bets, winnings, losses, net spend, session time, and responsible gambling limits.
- Add admin and support tools for user review, payment review, identity verification status, responsible gambling checks, and dispute handling.
- Add leaderboard functionality only after privacy, anti-abuse, ranking, opt-out, and fairness rules are defined.
