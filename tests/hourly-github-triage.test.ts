import { describe, expect, it } from "vitest";
import {
  buildSlackPayload,
  buildSlackReport,
  classifyIssue,
  extractIssueRefs,
  findForbiddenClosingRefs,
  latestLucasReview,
  summarizeChecks,
} from "../scripts/hourly-github-triage.mjs";

describe("hourly GitHub triage Slack report", () => {
  it("extracts only Refs issue links for coverage", () => {
    expect(extractIssueRefs("Refs #124\nRefs #122")).toEqual([122, 124]);
    expect(extractIssueRefs("Closes #124\nFixes #125")).toEqual([]);
  });

  it("detects forbidden closing refs without treating them as coverage", () => {
    expect(findForbiddenClosingRefs("Closes #124\nFixes #125\nResolves #126")).toEqual([124, 125, 126]);
  });

  it("classifies the design reset issue range as design/takeoff", () => {
    expect(classifyIssue({ number: 130, title: "PR 8 — Preenchimento Manual Novo", body: "" })).toBe(
      "Design Reset / Takeoff Assistido por IA"
    );
  });

  it("parses the latest Lucas Review status", () => {
    const review = latestLucasReview([
      {
        body: "regular comment",
        created_at: "2026-05-06T10:00:00Z",
      },
      {
        body: "## Lucas Review\n\nStatus: não aprovado\n\nRefazer tela interna.",
        created_at: "2026-05-06T11:00:00Z",
        user: { login: "lspassos1" },
      },
      {
        body: "## Lucas Review\n\nStatus: aprovado para merge manual\n\nPode seguir.",
        created_at: "2026-05-06T12:00:00Z",
        user: { login: "lspassos1" },
      },
    ]);

    expect(review).toMatchObject({
      status: "aprovado para merge manual",
      severity: "aprovado para merge manual",
      author: "lspassos1",
    });
  });

  it("summarizes failed, pending, green and unknown checks", () => {
    expect(summarizeChecks({ checkRuns: [{ status: "completed", conclusion: "failure" }] }).state).toBe("failed");
    expect(
      summarizeChecks({
        checkRuns: [
          { status: "completed", conclusion: "startup_failure" },
          { status: "completed", conclusion: "stale" },
        ],
      })
    ).toMatchObject({ state: "failed", label: "falhando (2/2)" });
    expect(summarizeChecks({ checkRuns: [{ status: "in_progress", conclusion: null }] }).state).toBe("pending");
    expect(summarizeChecks({ checkRuns: [{ status: "completed", conclusion: "success" }] }).state).toBe("success");
    expect(summarizeChecks({ checkRuns: [], statuses: [] }).state).toBe("unknown");
  });

  it("builds a Slack report with issue coverage and safe operating rules", () => {
    const report = buildSlackReport({
      repo: "lspassos1/aframe-kingspan-local",
      generatedAt: new Date("2026-05-06T12:00:00.000Z"),
      runUrl: "https://github.com/lspassos1/aframe-kingspan-local/actions/runs/1",
      issues: [
        { number: 122, title: "Epic: Design Reset e Takeoff Assistido por IA", body: "" },
        { number: 124, title: "PR 2 — Design System Base", body: "" },
      ],
      pullRequests: [
        {
          number: 136,
          title: "feat: redesign public home workflow",
          draft: true,
          body: "Refs #125",
          base: { ref: "main" },
          checkSummary: { state: "success", label: "verde (3)" },
          lucasReview: null,
        },
        {
          number: 137,
          title: "feat: redesign start entry choices",
          draft: true,
          body: "Closes #126",
          base: { ref: "main" },
          checkSummary: { state: "failed", label: "falhando (1/3)" },
          lucasReview: { severity: "não aprovado" },
        },
      ],
    });

    expect(report).toContain("*GitHub triage hourly — lspassos1/aframe-kingspan-local*");
    expect(report).toContain("PRs bloqueados/não aprovados por Lucas: 1");
    expect(report).toContain("PRs com closing refs proibidos: 1");
    expect(report).toContain("ALERTA: closing ref #126");
    expect(report).toContain("Automação informativa");
    expect(report).not.toContain("hooks.slack.com");
  });

  it("deduplicates urgent PRs before applying the attention limit", () => {
    const report = buildSlackReport({
      repo: "lspassos1/aframe-kingspan-local",
      generatedAt: new Date("2026-05-06T12:00:00.000Z"),
      issues: [{ number: 126, title: "PR 4 — Start Novo", body: "" }],
      pullRequests: [
        {
          number: 137,
          title: "feat: redesign start entry choices",
          draft: true,
          body: "Closes #126",
          base: { ref: "main" },
          checkSummary: { state: "failed", label: "falhando (1/3)" },
          lucasReview: { severity: "não aprovado" },
        },
        {
          number: 138,
          title: "feat: expand plan analysis schema",
          draft: true,
          body: "Refs #127",
          base: { ref: "feat/start-design-reset" },
          checkSummary: { state: "failed", label: "falhando (1/3)" },
          lucasReview: null,
        },
      ],
    });
    const attention = report.split("*Atenção agora*")[1].split("*PRs abertos*")[0];

    expect(attention.match(/#137/g)).toHaveLength(1);
    expect(attention).toContain("#138");
  });

  it("chunks the Slack payload into mrkdwn blocks", () => {
    const payload = buildSlackPayload("line\n".repeat(900));

    expect(payload.text).toContain("line");
    expect(payload.blocks.length).toBeGreaterThan(1);
    expect(payload.blocks.every((block) => block.type === "section")).toBe(true);
  });
});
