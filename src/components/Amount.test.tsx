import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PrivacyModeProvider } from "../context/PrivacyContext";
import { Amount } from "./Amount";

describe("Amount", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a grouped default format", () => {
    render(
      <PrivacyModeProvider initialPrivacyMode={false}>
        <Amount value={1234.5} />
      </PrivacyModeProvider>,
    );

    expect(screen.getByText("1,234.5")).toBeInTheDocument();
  });

  it("uses a custom formatter and keeps the symbol visible", () => {
    render(
      <PrivacyModeProvider initialPrivacyMode={false}>
        <Amount value={1234} format={(value) => `$${value}`} symbol="XLM" />
      </PrivacyModeProvider>,
    );

    expect(screen.getByText(/\$1234/)).toHaveTextContent("$1234 XLM");
  });

  it("masks the value in privacy mode without leaving the real value in the DOM", () => {
    render(
      <PrivacyModeProvider initialPrivacyMode>
        <Amount
          value={9876.54}
          format={(value) => `$${value}`}
          symbol="XLM"
          maskedLabel="Balance hidden for privacy"
        />
      </PrivacyModeProvider>,
    );

    expect(screen.queryByText("$9876.54")).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/9876/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Balance hidden for privacy")).toBeInTheDocument();
    expect(screen.getByText("••••")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders an em dash for missing values", () => {
    render(
      <PrivacyModeProvider initialPrivacyMode={false}>
        <Amount value={null} />
      </PrivacyModeProvider>,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
