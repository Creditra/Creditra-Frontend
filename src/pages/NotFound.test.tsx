/// <reference types="vitest" />import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { NotFound } from "./NotFound";

describe("NotFound", () => {
  it("renders the 404 page with correct content", () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>,
    );

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The page you're looking for doesn't exist or has been moved.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go back/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /contact support/i }),
    ).toBeInTheDocument();
  });

  it("has accessible elements", () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Go back to previous page"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Return to dashboard")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Contact support via email"),
    ).toBeInTheDocument();
  });
});
