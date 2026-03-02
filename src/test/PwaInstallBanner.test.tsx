import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UsePwaInstallReturn } from "../usePwaInstall";

vi.mock("../usePwaInstall");

import PwaInstallBanner from "../components/PwaInstallBanner";
import { usePwaInstall } from "../usePwaInstall";

const mockedUsePwaInstall = vi.mocked(usePwaInstall);

function mockHook(overrides: Partial<UsePwaInstallReturn> = {}) {
  mockedUsePwaInstall.mockReturnValue({
    canInstall: false,
    install: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  });
}

describe("PwaInstallBanner", () => {
  beforeEach(() => {
    mockHook();
  });

  it("renders nothing when canInstall is false", () => {
    const { container } = render(<PwaInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when canInstall is true", () => {
    mockHook({ canInstall: true });

    render(<PwaInstallBanner />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Installeren")).toBeInTheDocument();
    expect(screen.getByText("Niet nu")).toBeInTheDocument();
    expect(screen.getByText("Post aanmelden app")).toBeInTheDocument();
  });

  it("calls dismiss when 'Niet nu' is clicked", () => {
    const mockDismiss = vi.fn();
    mockHook({ canInstall: true, dismiss: mockDismiss });

    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByText("Niet nu"));

    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("calls dismiss when close button is clicked", () => {
    const mockDismiss = vi.fn();
    mockHook({ canInstall: true, dismiss: mockDismiss });

    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }));

    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("calls install when 'Installeren' is clicked", () => {
    const mockInstall = vi.fn().mockResolvedValue(undefined);
    mockHook({ canInstall: true, install: mockInstall });

    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByText("Installeren"));

    expect(mockInstall).toHaveBeenCalledOnce();
  });

  it("shows app icon with correct alt text", () => {
    mockHook({ canInstall: true });

    render(<PwaInstallBanner />);

    const icon = screen.getByAltText("App icoon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("src", "/pwa-192x192.png");
  });
});
