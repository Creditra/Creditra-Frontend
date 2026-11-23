/// <reference types="vitest" />
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Docs from "./Docs";
import { DRAW_STEPS, drawStepCountWord } from "@/lib/draw-steps";

function getDrawAndRepayBody(): string {
  const heading = screen.getByRole("heading", { name: "Draw and repay" });
  const section = heading.closest("section");
  if (!section) throw new Error("Draw and repay section is missing");
  return section.querySelector("p")?.textContent ?? "";
}

describe("Docs — draw and repay copy", () => {
  it("names every draw step and uses the count derived from the wizard steps", () => {
    render(
      <MemoryRouter>
        <Docs />
      </MemoryRouter>,
    );

    const body = getDrawAndRepayBody();
    const countWord = drawStepCountWord(DRAW_STEPS.length);

    expect(body).toContain(`${countWord}-step wizard`);
    expect(DRAW_STEPS).toHaveLength(4);
    expect(body).toContain("four-step wizard");

    for (const step of DRAW_STEPS) {
      expect(body.toLowerCase()).toContain(step.label.toLowerCase());
    }

    expect(body).toContain("default-risk education gate");
  });

  it("fails when the stated step count no longer matches the step list", () => {
    render(
      <MemoryRouter>
        <Docs />
      </MemoryRouter>,
    );

    const body = getDrawAndRepayBody();
    const wrongWord = drawStepCountWord(DRAW_STEPS.length + 1);

    expect(body).not.toContain(`${wrongWord}-step wizard`);
  });
});
