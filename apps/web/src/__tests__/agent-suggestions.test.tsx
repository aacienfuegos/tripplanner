import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentSuggestions } from "@/components/agents/agent-suggestions";
import { acceptAgentSuggestion, dismissAgentSuggestion } from "@/actions/suggestions";

vi.mock("@/actions/suggestions", () => ({
  acceptAgentSuggestion: vi.fn(async () => ({ ok: true })),
  dismissAgentSuggestion: vi.fn(async () => ({ ok: true })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const HTML = '<img src=x onerror="alert(1)">';

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Agent suggestions block (CA19, CA22, CA27)", () => {
  it("shows nothing without pending suggestions", () => {
    const { container } = render(<AgentSuggestions tripId="trip-a" items={[]} more={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each suggestion as text, with who suggested it, and accepts or dismisses that one", async () => {
    const { container } = render(
      <AgentSuggestions
        tripId="trip-a"
        items={[
          { id: "s1", title: "Ryokan Kurashiki", details: ["Kurashiki", "Apr 5, 2026 – Apr 6, 2026"], notes: HTML, by: "Investigador" },
          { id: "s2", title: null, details: [], notes: null, by: null },
        ]}
        more={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Agent suggestions" })).toBeInTheDocument();
    expect(screen.getByText("Ryokan Kurashiki")).toBeInTheDocument();
    expect(screen.getByText("Suggested by Investigador")).toBeInTheDocument();
    expect(screen.getByText("Kurashiki · Apr 5, 2026 – Apr 6, 2026")).toBeInTheDocument();
    expect(screen.getByText(HTML)).toBeInTheDocument();
    expect(screen.getByText("Suggestion without valid data")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/more pending suggestions/)).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]);
    await waitFor(() => expect(acceptAgentSuggestion).toHaveBeenCalledWith("trip-a", "s1"));
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]);
    await waitFor(() => expect(dismissAgentSuggestion).toHaveBeenCalledWith("trip-a", "s2"));
  });

  it("says when there are more pending than it shows", () => {
    render(<AgentSuggestions tripId="trip-a" items={[{ id: "s1", title: "Ryokan", details: [], notes: null, by: null }]} more />);
    expect(screen.getByText("There are more pending suggestions: they show here as you accept or dismiss these.")).toBeInTheDocument();
  });
});
