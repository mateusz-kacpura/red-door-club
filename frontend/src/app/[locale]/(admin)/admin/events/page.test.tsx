import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminEventsPage from "./page";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost, patch: mockPatch },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeEvent = (overrides = {}) => ({
  id: "event-uuid-1",
  title: "Finance Mixer",
  description: "Quarterly network event",
  event_type: "mixer",
  target_segments: ["Finance & Investors"],
  capacity: 50,
  ticket_price: "0.00",
  starts_at: new Date("2026-06-15T19:00:00Z").toISOString(),
  status: "draft",
  min_tier: null,
  rsvp_count: 0,
  ...overrides,
});

describe("AdminEventsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminEventsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no events", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
  });

  it("renders event list with title, status and type", async () => {
    mockGet.mockResolvedValue([makeEvent()]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText("Finance Mixer")).toBeInTheDocument();
    });
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("mixer")).toBeInTheDocument();
  });

  it("shows Create Event button and toggles form open", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
    const createBtn = screen.getByRole("button", { name: /create event/i });
    await userEvent.click(createBtn);
    expect(screen.getByText(/new event/i)).toBeInTheDocument();
  });

  it("cancel button closes the create form", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /create event/i }));
    expect(screen.getByText(/new event/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/new event/i)).not.toBeInTheDocument();
  });

  it("clicking edit button opens form pre-filled with event data", async () => {
    const event = makeEvent({ title: "Finance Mixer", status: "draft", event_type: "mixer" });
    mockGet.mockResolvedValue([event]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText("Finance Mixer")).toBeInTheDocument();
    });
    // Click the pencil/edit button
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[editButtons.length - 1]);
    // Form title switches to "edit event"
    expect(screen.getByText(/edit event/i)).toBeInTheDocument();
    // Title input is pre-filled
    const titleInput = screen.getByDisplayValue("Finance Mixer");
    expect(titleInput).toBeInTheDocument();
  });

  it("edit form shows Save Changes button instead of Create Event", async () => {
    const event = makeEvent({ title: "Tech Summit" });
    mockGet.mockResolvedValue([event]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText("Tech Summit")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[editButtons.length - 1]);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("submitting create form calls POST and refreshes list", async () => {
    const newEvent = makeEvent({ id: "event-uuid-2", title: "New Dinner", status: "draft" });
    mockGet
      .mockResolvedValueOnce([])         // initial load
      .mockResolvedValueOnce([newEvent]); // after create
    mockPost.mockResolvedValue(newEvent);

    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });

    // Open create form using the top-level header button
    const [headerCreateBtn] = screen.getAllByRole("button", { name: /create event/i });
    await userEvent.click(headerCreateBtn);

    // Fill in required fields
    const titleInput = screen.getByPlaceholderText(/event title/i);
    await userEvent.type(titleInput, "New Dinner");
    const dateInput = document.querySelector("input[type='datetime-local']") as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01T19:00");

    // Submit using the form's submit button (last "create event" button)
    const allCreateBtns = screen.getAllByRole("button", { name: /create event/i });
    await userEvent.click(allCreateBtns[allCreateBtns.length - 1]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/admin/events", expect.objectContaining({ title: "New Dinner" }));
    });
  });

  it("submitting edit form calls PATCH and refreshes list", async () => {
    const event = makeEvent({ title: "Old Title" });
    const updated = makeEvent({ title: "Updated Title", status: "published" });
    mockGet
      .mockResolvedValueOnce([event])    // initial load
      .mockResolvedValueOnce([updated]); // after PATCH
    mockPatch.mockResolvedValue(updated);

    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText("Old Title")).toBeInTheDocument();
    });

    // Click edit
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[editButtons.length - 1]);

    // Submit save
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        `/admin/events/${event.id}`,
        expect.objectContaining({ title: "Old Title" })
      );
    });
  });

  it("shows status transition buttons for published events", async () => {
    const event = makeEvent({ status: "published" });
    mockGet.mockResolvedValue([event]);
    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByText("Finance Mixer")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /complete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("clicking Publish status button calls PATCH with published status", async () => {
    const event = makeEvent({ id: "event-uuid-1", status: "draft" });
    const published = makeEvent({ id: "event-uuid-1", status: "published" });
    mockGet
      .mockResolvedValueOnce([event])
      .mockResolvedValueOnce([published]);
    mockPatch.mockResolvedValue(published);

    render(<AdminEventsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/admin/events/event-uuid-1", { status: "published" });
    });
  });
});
