import {
  calculateVirtualPlayerStyleProfile,
  type VirtualStyleStatsHand
} from "./virtual-style-stats";

const baseStartedAt = new Date("2026-05-19T10:00:00.000Z");
const targetUserId = "user-1";
const targetSeatId = "seat-1";

describe("virtual style stats", () => {
  it("counts VPIP/PFR, aggression, showdown, all-in, timing and pot stats", () => {
    const profile = calculateVirtualPlayerStyleProfile(
      [
        createHand({
          actions: [
            action("POST_BIG_BLIND", targetSeatId, 100n),
            action("CHECK", targetSeatId, null)
          ],
          finalStackChips: 1000n
        }),
        createHand({
          actions: [action("CALL", targetSeatId, 100n)],
          finalStackChips: 900n
        }),
        createHand({
          actions: [action("RAISE", targetSeatId, 300n)],
          awards: [{ winnerSeatId: targetSeatId, amountChips: 600n, handRankJson: { rank: "PAIR" } }],
          finalStackChips: 1300n,
          isEligibleForShowdown: true,
          timers: [
            timer({
              seatId: targetSeatId,
              remindedAt: new Date(baseStartedAt.getTime() + 30_000),
              resolvedAt: new Date(baseStartedAt.getTime() + 42_000)
            })
          ]
        }),
        createHand({
          actions: [
            action("RAISE", "seat-2", 300n),
            action("FOLD", targetSeatId, null)
          ],
          finalStackChips: 950n
        }),
        createHand({
          actions: [action("ALL_IN", targetSeatId, 1000n)],
          awards: [{ winnerSeatId: targetSeatId, amountChips: 2200n, handRankJson: { rank: "FLUSH" } }],
          finalStackChips: 2200n,
          playerStatus: "ALL_IN",
          isEligibleForShowdown: true
        }),
        createHand({
          actions: [action("AUTO_FOLD", targetSeatId, null)],
          finalStackChips: 990n
        })
      ],
      targetUserId
    );

    expect(profile.sample.handsDealt).toBe(6);
    expect(profile.sample.isEnoughData).toBe(false);
    expect(profile.archetype.code).toBe("LEARNING");
    expect(profile.styleStats.vpipBps).toBe(5000);
    expect(profile.styleStats.pfrBps).toBe(3333);
    expect(profile.styleStats.aggressionFactorBps).toBe(200);
    expect(profile.styleStats.foldToRaiseBps).toBe(10_000);
    expect(profile.styleStats.showdownRateBps).toBe(3333);
    expect(profile.styleStats.showdownWinRateBps).toBe(10_000);
    expect(profile.styleStats.allInWinRateBps).toBe(10_000);
    expect(profile.styleStats.biggestPotWonChips).toBe("2200");
    expect(profile.styleStats.averagePotWonChips).toBe("1400");
    expect(profile.styleStats.averageDecisionTimeSeconds).toBe(42);
    expect(profile.styleStats.remindersReceived).toBe(1);
    expect(profile.styleStats.autoActionsCount).toBe(1);
  });

  it("does not count sitting-out hands as dealt", () => {
    const profile = calculateVirtualPlayerStyleProfile(
      [
        createHand({
          playerStatus: "SITTING_OUT",
          actions: []
        })
      ],
      targetUserId
    );

    expect(profile.sample.handsDealt).toBe(0);
    expect(profile.styleStats.vpipBps).toBe(0);
  });

  it("resolves archetypes by priority", () => {
    expect(
      calculateVirtualPlayerStyleProfile(
        createRepeatedHands(50, {
          actions: [action("RAISE", targetSeatId, 200n)],
          awards: [{ winnerSeatId: targetSeatId, amountChips: 240n, handRankJson: { rank: "PAIR" } }],
          finalStackChips: 1200n,
          isEligibleForShowdown: true,
          timers: [
            timer({
              seatId: targetSeatId,
              resolvedAt: new Date(baseStartedAt.getTime() + 75_000)
            })
          ]
        }),
        targetUserId
      ).archetype.code
    ).toBe("TANKER");

    expect(
      calculateVirtualPlayerStyleProfile(
        [
          ...createRepeatedHands(15, {
            actions: [action("RAISE", targetSeatId, 200n)],
            awards: [{ winnerSeatId: targetSeatId, amountChips: 240n, handRankJson: { rank: "PAIR" } }],
            finalStackChips: 1200n,
            isEligibleForShowdown: true
          }),
          ...createRepeatedHands(35, {
            actions: [action("CHECK", targetSeatId, null)],
            finalStackChips: 1000n
          })
        ],
        targetUserId
      ).archetype.code
    ).toBe("SHARK");

    expect(
      calculateVirtualPlayerStyleProfile(
        createRepeatedHands(50, {
          actions: [
            action("CALL", targetSeatId, 100n),
            action("RAISE", targetSeatId, 200n),
            action("BET", targetSeatId, 200n),
            action("ALL_IN", targetSeatId, 300n)
          ],
          finalStackChips: 1000n
        }),
        targetUserId
      ).archetype.code
    ).toBe("MANIAC");
  });
});

function createRepeatedHands(
  count: number,
  overrides: Partial<VirtualStyleStatsHand> & {
    finalStackChips?: bigint;
    playerStatus?: string;
    isEligibleForShowdown?: boolean;
    awards?: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: unknown;
    }>;
  }
): VirtualStyleStatsHand[] {
  return Array.from({ length: count }, (_, index) =>
    createHand({
      ...overrides,
      id: `hand-${index + 1}`
    })
  );
}

function createHand(
  overrides: Partial<VirtualStyleStatsHand> & {
    finalStackChips?: bigint;
    playerStatus?: string;
    isEligibleForShowdown?: boolean;
    awards?: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: unknown;
    }>;
  } = {}
): VirtualStyleStatsHand {
  return {
    id: overrides.id ?? "hand-1",
    bigBlindChips: overrides.bigBlindChips ?? 100n,
    players: overrides.players ?? [
      {
        seatId: targetSeatId,
        status: overrides.playerStatus ?? "ACTIVE",
        startingStackChips: 1000n,
        currentStackChips: overrides.finalStackChips ?? 1000n,
        isEligibleForShowdown: overrides.isEligibleForShowdown ?? true,
        seat: {
          userId: targetUserId
        }
      },
      {
        seatId: "seat-2",
        status: "ACTIVE",
        startingStackChips: 1000n,
        currentStackChips: 1000n,
        isEligibleForShowdown: true,
        seat: {
          userId: "user-2"
        }
      }
    ],
    actions: overrides.actions ?? [],
    pots: overrides.pots ?? [
      {
        awards: overrides.awards ?? []
      }
    ],
    timers: overrides.timers ?? []
  };
}

function action(
  actionType: NonNullable<VirtualStyleStatsHand["actions"]>[number]["actionType"],
  seatId: string | null,
  amountChips: bigint | null,
  street = "PRE_FLOP"
): NonNullable<VirtualStyleStatsHand["actions"]>[number] {
  return {
    seatId,
    actionType,
    amountChips,
    actorType: "PLAYER",
    metadataJson: {
      street
    },
    createdAt: baseStartedAt
  };
}

function timer(
  overrides: Partial<NonNullable<VirtualStyleStatsHand["timers"]>[number]> = {}
): NonNullable<VirtualStyleStatsHand["timers"]>[number] {
  return {
    seatId: overrides.seatId ?? targetSeatId,
    startedAt: overrides.startedAt ?? baseStartedAt,
    expiresAt: overrides.expiresAt ?? new Date(baseStartedAt.getTime() + 90_000),
    resolvedAt: overrides.resolvedAt ?? null,
    remindedAt: overrides.remindedAt ?? null,
    resolutionType: overrides.resolutionType ?? null
  };
}
