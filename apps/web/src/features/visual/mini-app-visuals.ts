export const miniAppVisuals = {
  home: "/visuals/home.svg",
  offline: "/visuals/offline.svg",
  "offline-hero": "/visuals/offline-hero-wide.jpg",
  "offline-hero-webp": "/visuals/offline-hero-wide.webp",
  online: "/visuals/online.svg",
  "online-hero": "/visuals/online-hero-wide.jpg",
  "online-hero-webp": "/visuals/online-hero-wide.webp",
  club: "/visuals/club.svg",
  "club-hero": "/visuals/club-hero-wide.jpg",
  "club-hero-webp": "/visuals/club-hero-wide.webp",
  leaderboard: "/visuals/leaderboard.svg",
  profile: "/visuals/profile.svg",
  "join-code": "/visuals/join-code.svg",
  "create-table": "/visuals/create-table.svg",
  "empty-state": "/visuals/empty-state.svg",
  "settlement-history": "/visuals/settlement-history.svg"
} as const;

export type MiniAppVisualKey = keyof typeof miniAppVisuals;

export function resolveMiniAppVisual(key: MiniAppVisualKey): string {
  return miniAppVisuals[key];
}
