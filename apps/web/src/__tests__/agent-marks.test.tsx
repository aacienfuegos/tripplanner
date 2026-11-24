import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { en } from "@/i18n";
import { AgentBadge, AgentLabelsProvider } from "@/components/agents/agent-badge";
import { AuditLog } from "@/components/agents/audit-log";
import { getAgentLabels } from "@/lib/agent-labels";
import { listAuditEntries } from "@/lib/agent-audit";
import { AUDIT_RETENTION_MS } from "@/lib/services/audit";
import { A, B, fakeServiceDb, seedTwoUsers } from "./helpers/fake-service-db";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/actions/agents", () => ({ restoreAgentDeletion: vi.fn() }));

const HTML = '<img src=x onerror="alert(1)">';

beforeEach(() => {
  seedTwoUsers();
  fakeServiceDb.rows("agentGrant").push(
    { id: "grant-a", userId: A, name: "Investigador" },
    { id: "grant-b", userId: B, name: "Otro agente" },
  );
});

function entry(userId: string, grantId: string, entityId: string, action: string, createdAt = new Date()) {
  return {
    id: `entry-${entityId}-${action}`,
    userId,
    grantId,
    createdAt,
    tripId: null,
    entityType: "Accommodation",
    entityId,
    action,
    changes: null,
    snapshot: null,
    restoredAt: null,
  };
}

describe("the mark of an agent's element (CA21, CA22)", () => {
  it("says who added it, as text even if the name carries HTML", () => {
    const { container } = render(
      <AgentLabelsProvider labels={{ "acc-1": { name: HTML, added: true } }}>
        <AgentBadge id="acc-1" />
      </AgentLabelsProvider>,
    );
    expect(screen.getByText(`Added by ${HTML}`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("says who edited it, and there is no mark without a label", () => {
    render(
      <AgentLabelsProvider labels={{ "acc-1": { name: "Investigador", added: false } }}>
        <AgentBadge id="acc-1" />
        <AgentBadge id="acc-2" />
      </AgentLabelsProvider>,
    );
    expect(screen.getAllByText(/Investigador/)).toHaveLength(1);
    expect(screen.getByText("Edited by Investigador")).toBeInTheDocument();
  });

  it.each([
    [A, "grant-a", "grant-b"],
    [B, "grant-b", "grant-a"],
  ])("only %s's connections name a mark; added if the connection created it", async (me, mine, theirs) => {
    fakeServiceDb.rows("agentAuditEntry").push(entry(me, mine, "created", "CREATED"));
    const labels = await getAgentLabels(me, [
      { id: "created", agentGrantId: mine },
      { id: "edited", agentGrantId: mine },
      { id: "foreign", agentGrantId: theirs },
      { id: "web", agentGrantId: null },
    ]);
    const name = me === A ? "Investigador" : "Otro agente";
    expect(labels).toEqual({ created: { name, added: true }, edited: { name, added: false } });
  });
});

describe("the register of the profile (CA20)", () => {
  it.each([
    [A, B],
    [B, A],
  ])("shows %s's entries of the last 90 days, newest first, and nothing of %s", async (me, other) => {
    const mine = me === A ? "grant-a" : "grant-b";
    const theirs = me === A ? "grant-b" : "grant-a";
    const day = 24 * 60 * 60 * 1000;
    fakeServiceDb.rows("agentAuditEntry").push(
      entry(me, mine, "old", "CREATED", new Date(Date.now() - AUDIT_RETENTION_MS - day)),
      entry(me, mine, "recent", "UPDATED", new Date(Date.now() - day)),
      entry(me, mine, "now", "CREATED"),
      entry(other, theirs, "foreign", "CREATED"),
    );

    const { entries, hasMore } = await listAuditEntries(me, { page: 0 });
    expect(entries.map((e) => e.entityId)).toEqual(["now", "recent"]);
    expect(hasMore).toBe(false);

    expect((await listAuditEntries(me, { grantId: mine, page: 0 })).entries).toHaveLength(2);
    expect((await listAuditEntries(me, { grantId: theirs, page: 0 })).entries).toEqual([]);
  });

  it("shows an edit's fields with their values before and after, as text", () => {
    const { container } = render(
      <AuditLog
        t={en}
        items={[
          {
            id: "e1",
            when: "Nov 24, 2026, 10:00 AM",
            connection: "Investigador",
            action: "UPDATED",
            entityType: "Accommodation",
            trip: "Japón",
            changes: { notes: [null, HTML], checkOut: ["2026-04-05", "2026-04-06"] },
            label: null,
            restorable: false,
            restored: null,
          },
        ]}
        connections={[{ id: "grant-a", name: "Investigador" }]}
        grant={null}
        page={0}
        hasMore={false}
      />,
    );
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("Accommodation")).toBeInTheDocument();
    expect(screen.getByText("in Japón")).toBeInTheDocument();
    expect(screen.getByText(HTML)).toBeInTheDocument();
    expect(screen.getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByText("2026-04-06")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  it("shows a deletion with the name it had and Restore, and a restored one with its date (CA12, CA20)", () => {
    const deletion = {
      when: "Nov 24, 2026, 10:00 AM",
      connection: "Investigador",
      action: "DELETED" as const,
      entityType: "Activity",
      trip: "Japón",
      changes: null,
      label: HTML,
    };
    const { container } = render(
      <AuditLog
        t={en}
        items={[
          { ...deletion, id: "e1", restorable: true, restored: null },
          { ...deletion, id: "e2", restorable: false, restored: "Nov 25, 2026, 9:00 AM" },
        ]}
        connections={[]}
        grant={null}
        page={0}
        hasMore={false}
      />,
    );
    expect(screen.getAllByText("Deleted")).toHaveLength(2);
    expect(screen.getAllByText(HTML)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(1);
    expect(screen.getByText("Restored on Nov 25, 2026, 9:00 AM")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
