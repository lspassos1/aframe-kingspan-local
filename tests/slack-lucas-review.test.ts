import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildLucasReviewComment,
  createLucasReviewHash,
  findExistingLucasReviewComment,
  normalizeLucasReviewStatus,
  parseLucasReviewCommand,
  postGitHubIssueComment,
  validateLucasReviewAccess,
  verifySlackSignature,
} from "@/lib/slack/lucas-review";

const nowMs = 1_770_000_000_000;
const timestamp = `${Math.floor(nowMs / 1000)}`;
const rawBody = new URLSearchParams({
  user_id: "U_LUCAS",
  channel_id: "C_DESIGN",
  command: "/lucas-review",
  text: "141 nao-aprovado Ajustar o manual stepper.",
}).toString();

function slackSignature(secret: string, body = rawBody, ts = timestamp) {
  return `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;
}

describe("Slack Lucas Review bridge", () => {
  it("accepts a valid Slack signature", () => {
    expect(
      verifySlackSignature({
        rawBody,
        signingSecret: "test-signing-secret",
        signature: slackSignature("test-signing-secret"),
        timestamp,
        nowMs,
      })
    ).toEqual({ ok: true });
  });

  it("rejects an invalid Slack signature without leaking secrets", () => {
    const result = verifySlackSignature({
      rawBody,
      signingSecret: "very-secret-value",
      signature: slackSignature("other-secret"),
      timestamp,
      nowMs,
    });

    expect(result).toEqual({ ok: false, reason: "invalid-signature" });
    expect(JSON.stringify(result)).not.toContain("very-secret-value");
  });

  it("rejects expired Slack timestamps", () => {
    expect(
      verifySlackSignature({
        rawBody,
        signingSecret: "test-signing-secret",
        signature: slackSignature("test-signing-secret", rawBody, "100"),
        timestamp: "100",
        nowMs,
      })
    ).toEqual({ ok: false, reason: "expired-timestamp" });
  });

  it("parses positional commands with explicit status", () => {
    const result = parseLucasReviewCommand("141 nao-aprovado O manual stepper ainda e checklist.");

    expect(result).toMatchObject({
      ok: true,
      value: {
        prNumber: 141,
        status: "não aprovado",
        message: "O manual stepper ainda e checklist.",
      },
    });
  });

  it("parses key-value commands with quoted message", () => {
    const result = parseLucasReviewCommand('pr=143 status=nao-aprovado message="Redesign interno ainda parece refresh superficial."');

    expect(result).toMatchObject({
      ok: true,
      value: {
        prNumber: 143,
        status: "não aprovado",
        message: "Redesign interno ainda parece refresh superficial.",
      },
    });
  });

  it("normalizes accepted statuses with and without accent", () => {
    expect(normalizeLucasReviewStatus("nao-aprovado")).toBe("não aprovado");
    expect(normalizeLucasReviewStatus("não-aprovado")).toBe("não aprovado");
    expect(normalizeLucasReviewStatus("aprovado-para-merge-manual")).toBe("aprovado para merge manual");
  });

  it("defaults to nao aprovado when status is absent", () => {
    expect(parseLucasReviewCommand("135 Design system ainda esta generico.")).toMatchObject({
      ok: true,
      value: {
        prNumber: 135,
        status: "não aprovado",
        message: "Design system ainda esta generico.",
      },
    });
  });

  it("rejects invalid PR numbers", () => {
    expect(parseLucasReviewCommand('pr=abc status=nao-aprovado message="Mensagem valida."')).toEqual({
      ok: false,
      reason: "invalid-pr",
    });
  });

  it("builds the Lucas Review GitHub comment format", () => {
    const comment = buildLucasReviewComment({
      prNumber: 141,
      status: "não aprovado",
      message: "Criar editores reais.",
      hash: "abc123",
    });

    expect(comment).toContain("## Lucas Review");
    expect(comment).toContain("Status: não aprovado");
    expect(comment).toContain("Fonte: Slack");
    expect(comment).toContain("PR: #141");
    expect(comment).toContain("Criar editores reais.");
    expect(comment).toContain("<!-- lucas-review-slack:abc123 -->");
    expect(comment).toContain("- Não marcar ready.");
  });

  it("creates a stable dedupe hash", () => {
    const values = {
      prNumber: 141,
      status: "não aprovado" as const,
      message: "Criar editores reais.",
      slackUser: "U_LUCAS",
      slackChannel: "C_DESIGN",
    };

    expect(createLucasReviewHash(values)).toBe(createLucasReviewHash(values));
    expect(createLucasReviewHash(values)).toHaveLength(64);
  });

  it("blocks non-allowed Slack users and channels", () => {
    expect(
      validateLucasReviewAccess({
        slackUserId: "U_OTHER",
        slackChannelId: "C_DESIGN",
        allowedUserIds: "U_LUCAS",
      })
    ).toEqual({ ok: false, reason: "user-not-allowed" });

    expect(
      validateLucasReviewAccess({
        slackUserId: "U_LUCAS",
        slackChannelId: "C_OTHER",
        allowedChannelIds: "C_DESIGN",
      })
    ).toEqual({ ok: false, reason: "channel-not-allowed" });
  });

  it("finds existing Lucas Review comments by dedupe marker", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify([
          { id: 1, body: "regular comment" },
          { id: 2, body: "## Lucas Review\n<!-- lucas-review-slack:abc123 -->" },
        ]),
        { status: 200 }
      )) as typeof fetch;

    await expect(
      findExistingLucasReviewComment({
        token: "github-token",
        repo: "lspassos1/aframe-kingspan-local",
        prNumber: 141,
        hash: "abc123",
        fetchImpl,
      })
    ).resolves.toMatchObject({ id: 2 });
  });

  it("posts GitHub comments without exposing the token in the body", async () => {
    let postedBody = "";
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      postedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: 10, body: "created" }), { status: 201 });
    }) as typeof fetch;

    await postGitHubIssueComment({
      token: "github-token",
      repo: "lspassos1/aframe-kingspan-local",
      prNumber: 141,
      body: "## Lucas Review",
      fetchImpl,
    });

    expect(postedBody).toBe(JSON.stringify({ body: "## Lucas Review" }));
    expect(postedBody).not.toContain("github-token");
  });
});
