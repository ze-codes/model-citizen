import { describe, expect, test } from "bun:test";
import { buildPayload } from "../payload.ts";
import { resolveReceipts } from "./approve.ts";
import {
  previewAndSubmit,
  submitPayload,
} from "./submit.ts";
import {
  excerptFixture,
  statsFixture,
  verdictFixture,
} from "./test-fixtures.ts";

function payloadFixture() {
  const verdict = verdictFixture();
  const receipts = resolveReceipts(
    verdict,
    statsFixture,
    [excerptFixture],
  );
  return buildPayload(verdict, statsFixture, receipts);
}

describe("payload preview and submission", () => {
  test("--local-only previews exact JSON and performs zero network calls", async () => {
    const payload = payloadFixture();
    let fetchCalls = 0;
    const json: string[] = [];
    const result = await previewAndSubmit(payload, {
      localOnly: true,
      yes: true,
      fetch: (async () => {
        fetchCalls++;
        throw new Error("network must remain disabled");
      }) as typeof fetch,
      print: () => {},
      printJson: (value) => json.push(value),
    });
    expect(result).toBeNull();
    expect(fetchCalls).toBe(0);
    expect(json).toEqual([JSON.stringify(payload, null, 2)]);
  });

  test("non-TTY submission defaults to no unless --yes is present", async () => {
    let fetchCalls = 0;
    const result = await previewAndSubmit(payloadFixture(), {
      tty: false,
      fetch: (async () => {
        fetchCalls++;
        throw new Error("should not submit");
      }) as typeof fetch,
      print: () => {},
      printJson: () => {},
    });
    expect(result).toBeNull();
    expect(fetchCalls).toBe(0);
  });

  test("device flow submits the exact approved payload", async () => {
    const payload = payloadFixture();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = input instanceof Request ? input.url : String(input);
      requests.push({ url, init });

      if (url.endsWith("/oauth/device/code")) {
        return Response.json({
          device_code: "synthetic-device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://example.test/device",
          expires_in: 600,
          interval: 1,
        });
      }
      if (url.endsWith("/oauth/token")) {
        return Response.json({ access_token: "synthetic-access-token" });
      }
      if (url.endsWith("/api/scorecards")) {
        return Response.json({
          handle: "synthetic-citizen",
          url: "https://example.test/u/synthetic-citizen",
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await submitPayload(payload, {
      server: "https://example.test/apps/modelcitizen",
      fetch: fetchMock,
      print: () => {},
    });

    expect(result.handle).toBe("synthetic-citizen");
    expect(requests.map(({ url }) => url)).toEqual([
      "https://example.test/apps/modelcitizen/oauth/device/code",
      "https://example.test/apps/modelcitizen/oauth/token",
      "https://example.test/apps/modelcitizen/api/scorecards",
    ]);
    expect(JSON.parse(String(requests[2].init?.body))).toEqual(payload);
    expect(new Headers(requests[2].init?.headers).get("authorization")).toBe(
      "Bearer synthetic-access-token",
    );
  });
});
