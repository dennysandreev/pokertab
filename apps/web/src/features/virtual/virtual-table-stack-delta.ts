import type { GetVirtualTableResponseDto } from "@pokertable/shared";

type VirtualSeat = GetVirtualTableResponseDto["seats"][number];

export type SeatStackDeltaAnimation = {
  delta: number;
  direction: "win" | "loss";
  label: string;
};

export function createSeatStackMap(
  seats: VirtualSeat[]
): Record<string, string> {
  return Object.fromEntries(seats.map((seat) => [seat.id, seat.stackChips]));
}

export function buildSeatStackDeltaAnimations(
  previousStacks: Record<string, string>,
  seats: VirtualSeat[]
): Record<string, SeatStackDeltaAnimation> {
  return seats.reduce<Record<string, SeatStackDeltaAnimation>>((result, seat) => {
    const previous = parseChipAmount(previousStacks[seat.id]);
    const next = parseChipAmount(seat.stackChips);
    const delta = next - previous;

    if (delta === 0) {
      return result;
    }

    result[seat.id] = {
      delta: Math.abs(delta),
      direction: delta > 0 ? "win" : "loss",
      label: `${delta > 0 ? "+" : "-"}${Math.abs(delta)}`
    };

    return result;
  }, {});
}

function parseChipAmount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);

  return Number.isFinite(parsed) ? parsed : 0;
}
