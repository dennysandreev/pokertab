# Codex Initial Prompt

You are working on a new Telegram Mini App called Poker Table.

Read all project documentation before coding:

- `AGENTS.md`
- `README.md`
- `docs/00-product-brief.md`
- `docs/01-mvp-scope.md`
- `docs/02-user-flows.md`
- `docs/03-screens-ui-spec.md`
- `docs/04-roles-permissions.md`
- `docs/05-domain-model.md`
- `docs/06-database-prisma.md`
- `docs/07-api-contracts.md`
- `docs/08-calculations-settlement.md`
- `docs/09-leaderboard-statistics.md`
- `docs/10-telegram-miniapp-bot.md`
- `docs/11-frontend-implementation.md`
- `docs/12-backend-implementation.md`
- `docs/13-testing-acceptance.md`
- `docs/14-security-privacy-compliance.md`
- `docs/15-mvp-sprints.md`
- `docs/16-architecture-stack.md`
- `docs/17-development-plan.md`
- `docs/18-agent-workflow.md`

Your task is to implement the project incrementally.

Important product boundary:
- This is not a casino app.
- Do not implement deposits, withdrawals, wallets, payment processing, betting odds, or gambling mechanics.
- This app only tracks private home poker buy-ins/rebuys and calculates final settlement instructions.
- User-facing UI copy must be Russian for MVP.
- API money fields must be serialized as decimal strings.
- Rebuy creation must use backend idempotency.
- MVP includes both global and played-with-me leaderboard scopes.

Development workflow:
- Architecture and planning documents are owned by the main agent.
- Application code should be delegated to subagents and then reviewed/accepted by the main agent.

Start with `prompts/CODEX_TASK_01_SCAFFOLD.md`.
