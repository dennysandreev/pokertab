export const miniAppVisuals = {
  home: "/visuals/home.svg",
  offline: "/visuals/offline.svg",
  "offline-hero": "/visuals/offline-hero.png",
  "offline-hero-webp": "/visuals/offline-hero.webp",
  online: "/visuals/online.svg",
  "online-hero": "/visuals/online-hero.png",
  "online-hero-webp": "/visuals/online-hero.webp",
  club: "/visuals/club.svg",
  "club-hero": "/visuals/club-hero.jpg",
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
