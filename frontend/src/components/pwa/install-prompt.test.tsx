import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { InstallPrompt } from "./install-prompt";

function makeBeforeInstallPromptEvent() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "dismissed" });
  return event;
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render initially", () => {
    render(<InstallPrompt />);
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });

  it("renders install banner after beforeinstallprompt event", async () => {
    render(<InstallPrompt />);

    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.getByText("Add to Home Screen")).toBeDefined();
    expect(screen.getByRole("button", { name: /install/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /not now/i })).toBeDefined();
  });

  it("calls prompt on Install click", async () => {
    render(<InstallPrompt />);

    const event = makeBeforeInstallPromptEvent();
    await act(async () => {
      window.dispatchEvent(event);
    });

    const installButton = screen.getByRole("button", { name: /install/i });
    await act(async () => {
      fireEvent.click(installButton);
    });

    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it("dismisses on Not now click", async () => {
    render(<InstallPrompt />);

    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.getByText("Add to Home Screen")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    });

    expect(screen.queryByText("Add to Home Screen")).toBeNull();
    expect(localStorage.getItem("pwa-install-dismissed")).toBe("1");
  });

  it("does not show if already dismissed", async () => {
    localStorage.setItem("pwa-install-dismissed", "1");

    render(<InstallPrompt />);

    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });
});
