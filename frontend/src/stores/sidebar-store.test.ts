import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "./sidebar-store";

describe("Sidebar Store", () => {
  beforeEach(() => {
    // Reset to initial state before each test
    useSidebarStore.setState({ isOpen: false });
  });

  it("should have isOpen=false as initial state", () => {
    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it("open() sets isOpen to true", () => {
    useSidebarStore.getState().open();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("close() sets isOpen to false", () => {
    useSidebarStore.setState({ isOpen: true });
    useSidebarStore.getState().close();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });

  it("toggle() flips isOpen from false to true", () => {
    useSidebarStore.setState({ isOpen: false });
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("toggle() flips isOpen from true to false", () => {
    useSidebarStore.setState({ isOpen: true });
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });

  it("open() is idempotent when already open", () => {
    useSidebarStore.getState().open();
    useSidebarStore.getState().open();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("close() is idempotent when already closed", () => {
    useSidebarStore.getState().close();
    useSidebarStore.getState().close();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });

  it("open then close resets to closed state", () => {
    useSidebarStore.getState().open();
    useSidebarStore.getState().close();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});
