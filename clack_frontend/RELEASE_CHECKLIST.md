# Frontend Release Gates

## Environment
- Copy `.env.example` to `.env.local`.
- Fill `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Fill `NEXT_PUBLIC_CLAC_FACTORY_ADDRESS` with deployed contract.
- Confirm `NEXT_PUBLIC_BACKEND_URL` points to live backend.

## Smoke Scenarios
- `npm run smoke:release`
- Connect wallet and switch to Monad Testnet.
- Buy and sell from token detail page.
- Confirm dead token state blocks trade actions.
- Claim from portfolio claimable section.
- Refresh page and confirm wallet reconnects.

## Quality Gates
- `npm run lint`
- `npm run build`
- Manual mobile check at `375px` width (header, ticker, token detail, trade panel, portfolio).
- Verify wallet error states:
  - User rejected signature
  - Wrong chain selected
  - Insufficient funds
  - Backend timeout
