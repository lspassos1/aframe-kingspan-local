#!/usr/bin/env node
import { createHmac } from "node:crypto";

const endpoint = process.env.SLACK_REVIEW_TEST_URL || "http://localhost:3000/api/slack/lucas-review";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "local-test-signing-secret";
const text = process.argv.slice(2).join(" ") || "141 nao-aprovado Ajustar o manual stepper.";
const timestamp = `${Math.floor(Date.now() / 1000)}`;

const body = new URLSearchParams({
  token: "local-test-token",
  team_id: "T_LOCAL",
  team_domain: "local",
  channel_id: process.env.SLACK_TEST_CHANNEL_ID || "C_LOCAL",
  channel_name: "design-review",
  user_id: process.env.SLACK_TEST_USER_ID || "U_LOCAL",
  user_name: "lucas",
  command: "/lucas-review",
  text,
  response_url: "https://hooks.slack.com/commands/local/test",
  trigger_id: "local-trigger",
}).toString();

const signature = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex")}`;

console.log("Signed Slack Lucas Review request:");
console.log("");
console.log(`curl -X POST ${JSON.stringify(endpoint)} \\`);
console.log(`  -H ${JSON.stringify(`X-Slack-Request-Timestamp: ${timestamp}`)} \\`);
console.log(`  -H ${JSON.stringify(`X-Slack-Signature: ${signature}`)} \\`);
console.log(`  -H ${JSON.stringify("Content-Type: application/x-www-form-urlencoded")} \\`);
console.log(`  --data ${JSON.stringify(body)}`);
console.log("");
console.log("Set SLACK_SIGNING_SECRET in the app environment before sending this request.");
