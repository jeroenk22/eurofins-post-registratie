import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePwaInstall } from "../usePwaInstall";

function mockMatchMedia(standalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: standalone && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function makeInstallEvent() {
  return Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
}

describe("usePwaInstall", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockMatchMedia(false);
  });

  it("canInstall is false by default", () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes true when beforeinstallprompt fires", () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("dismiss sets canInstall to false and saves to sessionStorage", () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });

    expect(result.current.canInstall).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.canInstall).toBe(false);
    expect(sessionStorage.getItem("pwa-install-dismissed")).toBe("true");
  });

  it("canInstall stays false when already dismissed in sessionStorage", () => {
    sessionStorage.setItem("pwa-install-dismissed", "true");

    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });

    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall stays false when already in standalone mode", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });

    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes false after appinstalled fires", () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });

    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.canInstall).toBe(false);
  });

  it("install calls prompt and clears deferredPrompt on accept", async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: "accepted" as const });
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    });

    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(mockPrompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });

  it("install dismisses banner when user declines native prompt", async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: "dismissed" as const });
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    });

    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.canInstall).toBe(false);
    expect(sessionStorage.getItem("pwa-install-dismissed")).toBe("true");
  });
});
