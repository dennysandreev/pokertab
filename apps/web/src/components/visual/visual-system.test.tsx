import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveMiniAppVisual } from "@/features/visual/mini-app-visuals";
import {
  ActionTile,
  CompactGameRow,
  FormShell,
  IllustratedPanel,
  VisualEmptyState,
  VisualHero
} from "./index";

describe("visual system", () => {
  it("renders shared visual blocks without image sources", () => {
    const markup = renderToStaticMarkup(
      <div>
        <VisualHero description="Соберите следующую игру" title="Новый вечер" />
        <IllustratedPanel description="Код приглашения всегда под рукой" title="Приглашение" />
        <ActionTile title="Быстрый стол" />
        <FormShell title="Создать игру">Форма</FormShell>
        <VisualEmptyState />
        <CompactGameRow title="Cash 1/2" />
      </div>
    );

    expect(markup).toContain("Новый вечер");
    expect(markup).toContain("Соберите следующую игру");
    expect(markup).toContain("Приглашение");
    expect(markup).toContain("Пока пусто");
    expect(markup).toContain("Здесь скоро появится что-то важное.");
    expect(markup).toContain("Быстрый стол");
    expect(markup).toContain("Создать игру");
    expect(markup).toContain("Cash 1/2");
    expect(markup).toContain("background-image:");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("border-white/10");
    expect(markup).not.toContain("border-slate-200");
  });

  it("keeps action tile artwork inside the button", () => {
    const markup = renderToStaticMarkup(
      <ActionTile
        imageAlt="Create table"
        imageSrc={resolveMiniAppVisual("create-table")}
        title="Быстрый стол"
      />
    );

    expect(markup).toContain('src="/visuals/create-table.svg"');
    expect(markup).toContain('alt="Create table"');
    expect(markup).toMatch(/<button[\s\S]*src="\/visuals\/create-table\.svg"[\s\S]*<\/button>/);
  });

  it("renders compact empty state as a compact block", () => {
    const markup = renderToStaticMarkup(
      <VisualEmptyState
        compact
        description="Сыграете первую раздачу — история появится здесь."
        imageSrc={resolveMiniAppVisual("empty-state")}
        title="Истории пока нет"
      />
    );

    expect(markup).toContain("Истории пока нет");
    expect(markup).toContain("Сыграете первую раздачу");
    expect(markup).toContain('src="/visuals/empty-state.svg"');
    expect(markup).toContain("grid-cols-[3rem_minmax(0,1fr)]");
    expect(markup).not.toContain("min-h-[9rem]");
  });

  it("does not render the old visual watermark treatment", () => {
    const markup = renderToStaticMarkup(
      <div>
        <VisualHero imageSrc={resolveMiniAppVisual("home")} title="Домашний стол" />
        <IllustratedPanel imageSrc={resolveMiniAppVisual("join-code")} title="Приглашение" />
        <ActionTile imageSrc={resolveMiniAppVisual("create-table")} title="Быстрый стол" />
        <FormShell imageSrc={resolveMiniAppVisual("profile")} title="Профиль">
          Форма
        </FormShell>
        <VisualEmptyState imageSrc={resolveMiniAppVisual("empty-state")} />
        <CompactGameRow imageSrc={resolveMiniAppVisual("online")} title="Cash 1/2" />
      </div>
    );

    expect(markup).not.toContain("radial-gradient(circle_at_1px_1px");
    expect(markup).not.toContain("via-white/12");
    expect(markup).not.toContain("border-white/10");
    expect(markup).not.toContain("border-slate-200");
    expect(markup).not.toContain("h-36");
  });

  it("resolves all required mini app visual paths", () => {
    expect(resolveMiniAppVisual("home")).toBe("/visuals/home.svg");
    expect(resolveMiniAppVisual("offline")).toBe("/visuals/offline.svg");
    expect(resolveMiniAppVisual("offline-hero")).toBe("/visuals/offline-hero.png");
    expect(resolveMiniAppVisual("offline-hero-webp")).toBe("/visuals/offline-hero.webp");
    expect(resolveMiniAppVisual("online")).toBe("/visuals/online.svg");
    expect(resolveMiniAppVisual("online-hero")).toBe("/visuals/online-hero.png");
    expect(resolveMiniAppVisual("online-hero-webp")).toBe("/visuals/online-hero.webp");
    expect(resolveMiniAppVisual("club")).toBe("/visuals/club.svg");
    expect(resolveMiniAppVisual("leaderboard")).toBe("/visuals/leaderboard.svg");
    expect(resolveMiniAppVisual("profile")).toBe("/visuals/profile.svg");
    expect(resolveMiniAppVisual("join-code")).toBe("/visuals/join-code.svg");
    expect(resolveMiniAppVisual("create-table")).toBe("/visuals/create-table.svg");
    expect(resolveMiniAppVisual("empty-state")).toBe("/visuals/empty-state.svg");
    expect(resolveMiniAppVisual("settlement-history")).toBe("/visuals/settlement-history.svg");
  });
});
