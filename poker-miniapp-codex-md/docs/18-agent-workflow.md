# 18. Agent Workflow

## Core Agreement

Architecture, planning, product rules, acceptance criteria, and documentation are owned by
the main agent.

Application code is implemented by subagents. The main agent does not directly write app code
unless the user explicitly changes this rule.

The main agent:
- reads and updates architecture docs;
- creates scoped implementation tasks;
- delegates code work to subagents;
- reviews every diff;
- runs or requests relevant verification;
- accepts, rejects, or asks for revisions.

Subagents:
- work on assigned code slices;
- avoid unrelated refactors;
- do not revert changes made by others;
- report changed files and validation results.

## Subagent Model

Default implementation subagent:

```text
worker on gpt-5.4
```

Use `explorer` only for read-only codebase questions where implementation is not needed.

Use `worker` for:
- scaffolding;
- backend modules;
- frontend screens;
- shared packages;
- tests;
- bug fixes after root-cause investigation.

## Skill Usage

### `frontend-skill`

Use for:
- app surface hierarchy;
- visual restraint;
- mobile-first UX;
- reviewing whether the UI feels like a focused product tool.

Poker Table application UI should default to restrained product surfaces, not landing-page
composition.

### `content-design`

Use for:
- Russian UI labels;
- confirmation dialogs;
- empty states;
- error messages;
- tooltips;
- privacy-sensitive copy.

Adapt the skill principles to Russian product copy:
- short;
- natural;
- human;
- no internal field-name style;
- no blameful error text.

### `build-web-apps:react-best-practices`

Use for:
- React screen implementation;
- query/data-fetching patterns;
- avoiding unnecessary re-renders;
- keeping bundle size controlled;
- reviewing expensive or repeated calculations.

### `ui-ux-pro-max`

Use for:
- design-system direction;
- mobile/touch/accessibility checks;
- shadcn/Tailwind guidance;
- verifying screens against the dark fintech utility style.

### `systematic-debugging`

Use for:
- any failing test;
- build failure;
- unexpected runtime behavior;
- API/frontend mismatch;
- flaky E2E behavior;
- Telegram integration bug.

No fixes before root-cause investigation.

## Task Format for Subagents

Every implementation task should include:

```text
Context:
- product goal
- relevant docs
- current sprint

Ownership:
- exact files/modules the worker may edit
- files/modules to avoid

Requirements:
- endpoints/components/functions to implement
- behavior rules
- UI copy rules
- security/product boundaries

Tests:
- tests to add/update
- commands to run

Acceptance:
- concrete pass/fail criteria

Report:
- changed files
- validation commands and results
- assumptions
- unresolved risks
```

## Disjoint Write Sets

Parallel workers must have separate ownership.

Good parallel split:
- Worker A: `apps/api/src/rooms/**`, Prisma room models/tests.
- Worker B: `apps/web/src/features/rooms/**`, room UI/routes.
- Worker C: `packages/shared/src/rooms/**`, shared DTOs/schemas.

Bad parallel split:
- two workers editing the same API module;
- one worker changing shared DTOs while another assumes old shapes without coordination;
- broad "polish the frontend" tasks.

If shared contracts are needed, assign the shared contract first or make one worker own it.

## Review Process

Main-agent review order:

1. Read subagent report.
2. Inspect changed files.
3. Compare behavior against docs.
4. Check product boundaries:
   - Russian UI;
   - no payment UI;
   - no casino mechanics;
   - no wallets/deposits/withdrawals.
5. Check architecture boundaries:
   - backend owns auth/permissions;
   - frontend does not trust Telegram user data directly;
   - money uses minor units and API strings;
   - rebuy idempotency is backend-enforced.
6. Run relevant checks or inspect their output.
7. Accept, request revision, or reject.

## Acceptance States

### Accept

Use when:
- behavior matches docs;
- tests/checks pass;
- implementation is scoped;
- no product/security boundary is violated.

### Request revision

Use when:
- implementation is mostly correct;
- issues are local;
- no architectural reset is needed.

Revision request must include exact findings and files.

### Reject

Use when:
- worker changed unrelated architecture;
- payment/casino semantics were introduced;
- money or permissions are unsafe;
- implementation contradicts MVP scope;
- tests are missing for high-risk logic;
- the slice is not reviewable.

## Required Report from Subagents

Each worker must return:
- summary of changes;
- changed files;
- tests added;
- commands run;
- commands not run and why;
- assumptions;
- risks.

For frontend tasks, also report:
- mobile viewport checked;
- Russian copy checked;
- loading/error/empty states covered or explicitly deferred.

For backend tasks, also report:
- permission checks;
- transaction boundaries;
- idempotency/audit behavior where relevant.

## Debugging Workflow

When something fails, the main agent should either investigate directly or delegate a narrow
debugging task.

Debugging task must ask the subagent to:
1. reproduce the failure;
2. read the full error;
3. locate the failing component boundary;
4. compare with working examples;
5. state the root cause;
6. propose or implement one scoped fix;
7. run the failing check again.

Do not ask for "try fixing the test" without requiring root-cause evidence.

## Product Safety Checklist

Every code task must preserve:
- no deposits;
- no withdrawals;
- no wallet balances;
- no payment processing;
- no payment CTAs;
- no betting odds;
- no rake;
- no casino mechanics;
- no random rewards.

Allowed language:
- `ребай`;
- `закупы`;
- `финальная сумма`;
- `результат`;
- `кто кому переводит`;
- `перевод вручную`;
- `расчет`.

Avoid language:
- `депозит`;
- `кошелек`;
- `баланс кошелька`;
- `оплатить`;
- `вывести`;
- `ставка`;
- `коэффициент`;
- `выигрышный бонус`.

## UI Copy Review

Before accepting frontend work, check:
- all visible UI copy is Russian;
- labels sound like product text, not database fields;
- placeholders do not duplicate labels;
- error messages say what happened and what to do;
- confirmation dialogs state the consequence;
- destructive/financial buttons name the action precisely.

Examples:

Good:
- `Создать стол`
- `Добавить ребай`
- `Баланс не сходится`
- `Игра уже завершена`

Avoid:
- `Наименование комнаты`
- `Поле для ввода суммы`
- `Успешное создание сущности`
- `Подтверждение выполнения действия`

## Architecture Review Checklist

Backend:
- permissions on every private route;
- transactions for state changes;
- idempotency for rebuy creation;
- no hard deletes for audit data;
- money in minor units;
- no secrets in logs.

Frontend:
- TanStack Query for server state;
- local state only for forms/dialogs/drafts;
- controlled inputs for forms;
- no float math for money;
- no hidden admin actions for players;
- minimum 44px touch targets.

Shared:
- DTOs match API docs;
- enums match Prisma/domain docs;
- money helpers are tested.

Bot:
- token server-side only;
- links use `startapp`;
- bot copy reinforces accounting utility positioning.

## Completion Rule

A sprint is not complete because a subagent says it is complete.

A sprint is complete only after the main agent:
- reviews the implementation;
- verifies checks;
- confirms acceptance criteria;
- records remaining risks or explicitly says none are known.
