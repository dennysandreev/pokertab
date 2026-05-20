import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VirtualPlayingCard } from "./virtual-playing-card";

describe("virtual playing card", () => {
  it("renders centered rank and suit without mirrored bottom corner", () => {
    const markup = renderToStaticMarkup(<VirtualPlayingCard cardCode="AH" compact />);

    expect(markup).toContain('aria-label="A Червы"');
    expect(markup).toContain(">A<");
    expect(markup).toContain(">♥<");
    expect(markup).toContain("font-extrabold");
    expect(markup).toContain("overflow-hidden");
    expect(markup).toContain("rounded-[inherit]");
    expect(markup).not.toContain("rotate-180");
  });
});
