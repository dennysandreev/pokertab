import { INVITES_ERROR_CODES } from "./invites.constants";
import { InvitesService } from "./invites.service";

describe("InvitesService", () => {
  it("resolves an offline room invite code", async () => {
    const prisma = createPrismaMock();
    prisma.room.findFirst.mockResolvedValue({ inviteCode: "ROOM1234" });
    const service = new InvitesService(prisma as never);

    await expect(service.resolveInviteCode({ inviteCode: "room1234" })).resolves.toEqual({
      kind: "ROOM",
      inviteCode: "ROOM1234"
    });
  });

  it("resolves a virtual table invite code", async () => {
    const prisma = createPrismaMock();
    prisma.virtualTable.findFirst.mockResolvedValue({ inviteCode: "VIRT1234" });
    const service = new InvitesService(prisma as never);

    await expect(service.resolveInviteCode({ inviteCode: "virt1234" })).resolves.toEqual({
      kind: "VIRTUAL_TABLE",
      inviteCode: "VIRT1234"
    });
  });

  it("resolves a club invite code", async () => {
    const prisma = createPrismaMock();
    prisma.club.findFirst.mockResolvedValue({ inviteCode: "CLUB1234" });
    const service = new InvitesService(prisma as never);

    await expect(service.resolveInviteCode({ inviteCode: "club1234" })).resolves.toEqual({
      kind: "CLUB",
      inviteCode: "CLUB1234"
    });
  });

  it("returns not found for an unknown code", async () => {
    const service = new InvitesService(createPrismaMock() as never);

    await expect(service.resolveInviteCode({ inviteCode: "UNKNOWN1" })).rejects.toMatchObject({
      code: INVITES_ERROR_CODES.notFound
    });
  });

  it("returns conflict for ambiguous invite codes", async () => {
    const prisma = createPrismaMock();
    prisma.room.findFirst.mockResolvedValue({ inviteCode: "SAME1234" });
    prisma.club.findFirst.mockResolvedValue({ inviteCode: "SAME1234" });
    const service = new InvitesService(prisma as never);

    await expect(service.resolveInviteCode({ inviteCode: "SAME1234" })).rejects.toMatchObject({
      code: INVITES_ERROR_CODES.ambiguous
    });
  });
});

function createPrismaMock() {
  return {
    room: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    virtualTable: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    club: {
      findFirst: jest.fn().mockResolvedValue(null)
    }
  };
}
