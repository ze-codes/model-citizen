import type { ScorecardPayload } from "../payload.ts";

export const DEFAULT_SERVER = "https://over-drive.xyz/apps/modelcitizen";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

export interface SubmissionResult {
  handle: string;
  url: string;
  [key: string]: unknown;
}

export interface SubmitOptions {
  server?: string;
  fetch?: typeof fetch;
  print?: (line: string) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  onDeviceCode?: (device: DeviceCodeResponse) => void | Promise<void>;
}

export interface PreviewSubmitOptions extends SubmitOptions {
  yes?: boolean;
  localOnly?: boolean;
  tty?: boolean;
  ask?: (prompt: string) => Promise<string>;
  printJson?: (json: string) => void;
}

function endpoint(server: string, path: string): string {
  return `${server.replace(/\/+$/, "")}${path}`;
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string; message?: string; field?: string };
    return [body.error, body.field, body.message].filter(Boolean).join(": ") || text;
  } catch {
    return text || response.statusText;
  }
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body?: unknown,
  headers: HeadersInit = {},
): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function submitPayload(
  payload: ScorecardPayload,
  options: SubmitOptions = {},
): Promise<SubmissionResult> {
  const server = options.server ?? DEFAULT_SERVER;
  const fetchImpl = options.fetch ?? fetch;
  const print = options.print ?? console.error;
  const sleep = options.sleep ?? ((milliseconds) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  const deviceResponse = await postJson(
    fetchImpl,
    endpoint(server, "/oauth/device/code"),
  );
  if (!deviceResponse.ok) {
    throw new Error(`Device authorization failed (${deviceResponse.status}): ${await errorMessage(deviceResponse)}`);
  }
  const device = await deviceResponse.json() as DeviceCodeResponse;
  const verificationLink = device.verification_uri_complete ?? device.verification_uri;
  print(`Authorize this device at: ${verificationLink}`);
  print(`Device code: ${device.user_code}`);
  await options.onDeviceCode?.(device);

  const expiresAt = Date.now() + device.expires_in * 1_000;
  let intervalMs = Math.max(1, device.interval ?? 5) * 1_000;
  let accessToken = "";
  while (Date.now() < expiresAt) {
    const tokenResponse = await postJson(
      fetchImpl,
      endpoint(server, "/oauth/token"),
      { device_code: device.device_code },
    );
    if (tokenResponse.ok) {
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) throw new Error("Token response did not include an access token");
      accessToken = token.access_token;
      break;
    }

    const retryAfter = Number(tokenResponse.headers.get("retry-after"));
    let code = "";
    try {
      const body = await tokenResponse.json() as { error?: string; message?: string };
      code = body.error ?? "";
      if (code !== "authorization_pending" && code !== "slow_down") {
        throw new Error(
          `Device token exchange failed (${tokenResponse.status}): ${body.error ?? body.message ?? "unknown error"}`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Device token exchange failed")) throw error;
      throw new Error(`Device token exchange failed (${tokenResponse.status})`);
    }
    if (code === "slow_down") intervalMs += 5_000;
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      intervalMs = Math.max(intervalMs, retryAfter * 1_000);
    }
    await sleep(intervalMs);
  }
  if (!accessToken) throw new Error("Device authorization expired before approval");

  const submission = await postJson(
    fetchImpl,
    endpoint(server, "/api/scorecards"),
    payload,
    { Authorization: `Bearer ${accessToken}` },
  );
  if (!submission.ok) {
    throw new Error(`Scorecard submission failed (${submission.status}): ${await errorMessage(submission)}`);
  }
  const result = await submission.json() as SubmissionResult;
  print(`Scorecard published: ${result.url}`);
  return result;
}

async function defaultAsk(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise<string>((resolve) => {
    process.stdin.once("data", (chunk) => resolve(String(chunk).trim()));
  });
}

export async function previewAndSubmit(
  payload: ScorecardPayload,
  options: PreviewSubmitOptions = {},
): Promise<SubmissionResult | null> {
  const print = options.print ?? console.error;
  const printJson = options.printJson ?? console.log;
  print("Exact payload preview (this is everything the server will receive):");
  printJson(JSON.stringify(payload, null, 2));

  if (options.localOnly) {
    print("Local-only mode: submission skipped; no network request was made.");
    return null;
  }

  let approved = options.yes ?? false;
  if (options.yes) {
    print("Submission automatically approved (--yes).");
  } else {
    const tty = options.tty ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (!tty) {
      print("Submission declined automatically (non-interactive input; pass --yes to submit).");
      return null;
    }
    const answer = await (options.ask ?? defaultAsk)("Submit this exact payload? [y/N] ");
    approved = /^(y|yes)$/i.test(answer.trim());
  }
  if (!approved) {
    print("Submission cancelled.");
    return null;
  }
  return submitPayload(payload, options);
}
