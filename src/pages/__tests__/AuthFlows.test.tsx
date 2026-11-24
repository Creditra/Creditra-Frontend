import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { LoginPage } from "../LoginPage";

describe("Auth pages with MSW", () => {
  it("LoginPage signs in and navigates to dashboard on 200", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard View</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById("emailOrUsername")!, {
      target: { value: "alice@creditra.test" },
    });
    fireEvent.change(document.getElementById("password")!, {
      target: { value: "Password123!" },
    });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Dashboard View")).toBeInTheDocument();
    });
  });

  it("LoginPage surfaces 429 rate-limit error via server.use override", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { message: "Too many login attempts. Please try again later." },
          { status: 429 },
        ),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById("emailOrUsername")!, {
      target: { value: "alice@creditra.test" },
    });
    fireEvent.change(document.getElementById("password")!, {
      target: { value: "Password123!" },
    });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/too many login attempts/i),
      ).toBeInTheDocument();
    });
  });
});
