export const INVITE_CODE_TARGETS = ["ROOM", "VIRTUAL_TABLE", "CLUB"] as const;

export type InviteCodeTarget = (typeof INVITE_CODE_TARGETS)[number];

export type ResolveInviteCodeRequestDto = {
  inviteCode: string;
};

export type ResolveInviteCodeResponseDto = {
  kind: InviteCodeTarget;
  inviteCode: string;
};
