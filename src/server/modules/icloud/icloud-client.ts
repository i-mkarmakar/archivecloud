import "server-only";

import {
  AppleSrpAuthenticator,
  type SrpServerData,
} from "@/server/modules/icloud/apple-srp";

const CLIENT_ID =
  "d39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:103.0) Gecko/20100101 Firefox/103.0";
const AUTH_ENDPOINT = "https://idmsa.apple.com/appleauth/auth/";
const SETUP_ENDPOINT = "https://setup.icloud.com/setup/ws/1/accountLogin";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
  "Content-Type": "application/json",
  Origin: "https://www.icloud.com",
};

const AUTH_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  Origin: "https://idmsa.apple.com",
  Referer: "https://idmsa.apple.com/",
  "X-Apple-Widget-Key": CLIENT_ID,
  "X-Apple-OAuth-Client-Id": CLIENT_ID,
  "X-Apple-I-FD-Client-Info": JSON.stringify({
    U: USER_AGENT,
    L: "en-GB",
    Z: "GMT+01:00",
    V: "1.1",
    F: "",
  }),
  "X-Apple-OAuth-Response-Type": "code",
  "X-Apple-OAuth-Response-Mode": "web_message",
  "X-Apple-OAuth-Client-Type": "firstPartyAuth",
};

export type ICloudAccountInfo = {
  dsInfo?: {
    dsid?: string | number;
    fullName?: string;
    primaryEmail?: string;
    appleId?: string;
  };
  webservices?: Record<
    string,
    { url?: string; status?: string; pcsRequired?: boolean }
  >;
};

export type ICloudClientStatus = "idle" | "mfa_required" | "ready" | "error";

export class ICloudClient {
  status: ICloudClientStatus = "idle";
  accountInfo: ICloudAccountInfo | null = null;
  sessionId?: string;
  sessionToken?: string;
  scnt?: string;
  aasp?: string;
  trustToken?: string;
  accountCountry?: string;
  cookies: string[] = [];

  constructor(
    public appleId: string,
    private password: string,
  ) {}

  cookieHeader(): string {
    return this.cookies
      .map((raw) => {
        const parsed = parseCookie(raw);
        if (!parsed?.value || parsed.expired) return null;
        return raw.split(";")[0]?.trim() ?? null;
      })
      .filter((v): v is string => Boolean(v))
      .join("; ");
  }

  hasCookie(name: string): boolean {
    return this.cookies.some((raw) => {
      const c = parseCookie(raw);
      return c?.name === name && Boolean(c.value);
    });
  }

  apiHeaders(): Record<string, string> {
    return {
      ...DEFAULT_HEADERS,
      Cookie: this.cookieHeader(),
    };
  }

  private mfaHeaders(): Record<string, string> {
    return {
      ...AUTH_HEADERS,
      scnt: this.scnt ?? "",
      "X-Apple-ID-Session-Id": this.sessionId ?? "",
      Cookie: this.aasp ? `aasp=${this.aasp}` : "",
    };
  }

  private absorbAuthSecrets(res: Response) {
    // idmsa uses Session-Token as the MFA session id value.
    const sessionToken = res.headers.get("X-Apple-Session-Token");
    const sessionId = res.headers.get("X-Apple-ID-Session-Id") ?? sessionToken;
    if (sessionToken) this.sessionToken = sessionToken;
    if (sessionId) this.sessionId = sessionId;
    this.scnt = res.headers.get("scnt") ?? this.scnt;
    this.accountCountry =
      res.headers.get("X-Apple-ID-Account-Country") ?? this.accountCountry;
    const setCookies = getSetCookies(res);
    for (const raw of setCookies) {
      if (raw.toLowerCase().startsWith("aasp=")) {
        this.aasp = raw.split(";")[0]?.slice(5);
      }
    }
    return Boolean(this.sessionId && this.scnt);
  }

  private absorbCookies(res: Response) {
    const setCookies = getSetCookies(res);
    if (setCookies.length === 0) return false;
    let changed = false;
    for (const raw of setCookies) {
      const parsed = parseCookie(raw);
      if (!parsed) continue;
      this.cookies = this.cookies.filter((c) => {
        const existing = parseCookie(c);
        return existing?.name !== parsed.name;
      });
      // Expired / cleared Set-Cookie → drop from jar (don't send empty values).
      if (!parsed.value || parsed.expired) {
        changed = true;
        continue;
      }
      this.cookies.push(raw);
      changed = true;
    }
    return changed;
  }

  restore(session: {
    trustToken?: string;
    sessionToken?: string;
    cookies?: string[];
    accountInfo?: ICloudAccountInfo | null;
    accountCountry?: string;
  }) {
    this.trustToken = session.trustToken;
    this.sessionToken = session.sessionToken;
    this.cookies = (session.cookies ?? []).filter((raw) => {
      const parsed = parseCookie(raw);
      return Boolean(parsed?.value) && !parsed?.expired;
    });
    this.accountInfo = session.accountInfo ?? null;
    this.accountCountry = session.accountCountry;
    if (this.cookies.length > 0 && this.accountInfo) {
      this.status = "ready";
    }
  }

  toStored(): {
    trustToken?: string;
    sessionToken?: string;
    cookies: string[];
    accountInfo: ICloudAccountInfo | null;
    accountCountry?: string;
  } {
    return {
      trustToken: this.trustToken,
      sessionToken: this.sessionToken,
      cookies: this.cookies,
      accountInfo: this.accountInfo,
      accountCountry: this.accountCountry,
    };
  }

  async authenticate(): Promise<void> {
    const srpAuth = new AppleSrpAuthenticator(this.appleId);
    const init = await srpAuth.getInit();
    const initRes = await fetch(`${AUTH_ENDPOINT}signin/init`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(init),
    });
    if (!initRes.ok) {
      throw new Error(`Apple sign-in init failed (${initRes.status}).`);
    }
    const serverData = (await initRes.json()) as SrpServerData;
    const complete = await srpAuth.getComplete(this.password, serverData);

    const authRes = await fetch(
      `${AUTH_ENDPOINT}signin/complete?isRememberMeEnabled=true`,
      {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          ...complete,
          accountName: this.appleId,
          trustTokens: this.trustToken ? [this.trustToken] : [],
          rememberMe: true,
        }),
      },
    );

    if (authRes.status === 409) {
      if (!this.absorbAuthSecrets(authRes)) {
        throw new Error("Unable to process Apple MFA challenge.");
      }
      // iOS 26.4+ / current idmsa: 409 no longer auto-pushes; must PUT first.
      await this.requestTrustedDeviceCode();
      this.status = "mfa_required";
      return;
    }

    if (authRes.status === 200) {
      if (!this.absorbAuthSecrets(authRes)) {
        throw new Error("Unable to process Apple auth response.");
      }
      await this.finishSetup({ trustDevice: true });
      return;
    }

    if (authRes.status === 401) {
      throw new Error("Incorrect Apple ID or password.");
    }
    throw new Error(
      `Apple sign-in failed (${authRes.status}): ${await authRes.text()}`,
    );
  }

  /** Ask Apple to push a 6-digit code to trusted devices. */
  async requestTrustedDeviceCode(): Promise<void> {
    if (!this.sessionId || !this.scnt) {
      throw new Error("Start Apple sign-in before requesting a code.");
    }
    const res = await fetch(
      `${AUTH_ENDPOINT}verify/trusteddevice/securitycode`,
      {
        method: "PUT",
        headers: this.mfaHeaders(),
      },
    );
    // 200/202/204 all mean the push was accepted.
    if (res.status !== 200 && res.status !== 202 && res.status !== 204) {
      // Fall back to SMS if this account has no trusted-device push.
      const sentSms = await this.requestSmsCodeFallback();
      if (!sentSms) {
        throw new Error(
          `Could not send Apple verification code (${res.status}). Check a trusted device is signed into iCloud, then try again.`,
        );
      }
    }
  }

  private async requestSmsCodeFallback(): Promise<boolean> {
    const stateRes = await fetch(AUTH_ENDPOINT.replace(/\/$/, ""), {
      method: "GET",
      headers: this.mfaHeaders(),
    });
    if (!stateRes.ok) return false;
    this.absorbAuthSecrets(stateRes);
    const state = (await stateRes.json()) as {
      trustedPhoneNumbers?: Array<{ id: number; pushMode?: string }>;
      trustedPhoneNumber?: { id: number; pushMode?: string };
      phoneNumberVerification?: {
        trustedPhoneNumbers?: Array<{ id: number; pushMode?: string }>;
        trustedPhoneNumber?: { id: number; pushMode?: string };
      };
    };
    const nested = state.phoneNumberVerification;
    const phones =
      state.trustedPhoneNumbers ??
      nested?.trustedPhoneNumbers ??
      (state.trustedPhoneNumber
        ? [state.trustedPhoneNumber]
        : nested?.trustedPhoneNumber
          ? [nested.trustedPhoneNumber]
          : []);
    const phone = phones[0];
    if (!phone?.id) return false;
    const mode = phone.pushMode || "sms";
    const smsRes = await fetch(`${AUTH_ENDPOINT}verify/phone`, {
      method: "PUT",
      headers: this.mfaHeaders(),
      body: JSON.stringify({
        phoneNumber: { id: phone.id },
        mode,
      }),
    });
    return (
      smsRes.status === 200 || smsRes.status === 202 || smsRes.status === 204
    );
  }

  async provideMfaCode(code: string): Promise<void> {
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      throw new Error("Enter the 6-digit verification code.");
    }
    if (!this.sessionId || !this.scnt) {
      throw new Error("Start Apple sign-in before entering a code.");
    }

    const verifyRes = await fetch(
      `${AUTH_ENDPOINT}verify/trusteddevice/securitycode`,
      {
        method: "POST",
        headers: this.mfaHeaders(),
        body: JSON.stringify({ securityCode: { code: cleaned } }),
      },
    );
    // Apple now often returns 409 with valid:true + X-Apple-Session-Token.
    const sessionToken =
      verifyRes.headers.get("X-Apple-Session-Token") ??
      verifyRes.headers.get("X-Apple-ID-Session-Id");
    const ok =
      verifyRes.status === 204 ||
      verifyRes.status === 200 ||
      (verifyRes.status === 409 && Boolean(sessionToken));
    if (!ok) {
      throw new Error(`Invalid verification code (${verifyRes.status}).`);
    }
    this.absorbAuthSecrets(verifyRes);
    if (sessionToken) this.sessionToken = sessionToken;
    await this.finishSetup({ trustDevice: true });
  }

  private async finishSetup(opts: { trustDevice: boolean }) {
    if (opts.trustDevice) {
      const trustRes = await fetch(`${AUTH_ENDPOINT}2sv/trust`, {
        method: "GET",
        headers: this.mfaHeaders(),
      });
      this.absorbAuthSecrets(trustRes);
      this.sessionToken =
        trustRes.headers.get("X-Apple-Session-Token") ?? this.sessionToken;
      this.trustToken =
        trustRes.headers.get("X-Apple-TwoSV-Trust-Token") ?? this.trustToken;
    }

    if (!this.sessionToken) {
      throw new Error("Missing Apple session token.");
    }

    const setupRes = await fetch(SETUP_ENDPOINT, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        accountCountryCode: this.accountCountry,
        dsWebAuthToken: this.sessionToken,
        extended_login: true,
        trustToken: this.trustToken,
      }),
    });
    if (!setupRes.ok) {
      throw new Error(`iCloud setup failed (${setupRes.status}).`);
    }
    this.absorbCookies(setupRes);
    this.accountInfo = (await setupRes.json()) as ICloudAccountInfo & {
      termsUpdateNeeded?: boolean;
      dsInfo?: ICloudAccountInfo["dsInfo"] & {
        isWebAccessAllowed?: boolean;
      };
    };
    assertUsableWebSession(this);
    this.status = "ready";
  }

  async getStorageUsage(): Promise<{
    totalStorageInBytes?: number;
    usedStorageInBytes?: number;
  }> {
    const res = await fetch(
      "https://setup.icloud.com/setup/ws/1/storageUsageInfo",
      {
        method: "POST",
        headers: this.apiHeaders(),
        body: "{}",
      },
    );
    if (!res.ok) throw new Error(`Quota fetch failed (${res.status}).`);
    this.absorbCookies(res);
    const json = (await res.json()) as {
      storageUsageInfo?: {
        totalStorageInBytes?: number;
        usedStorageInBytes?: number;
      };
    };
    return json.storageUsageInfo ?? {};
  }

  webserviceUrl(name: string): string {
    const url = this.accountInfo?.webservices?.[name]?.url;
    if (!url) throw new Error(`iCloud service "${name}" unavailable.`);
    return url.replace(/\/$/, "");
  }

  dsid(): string | undefined {
    const id = this.accountInfo?.dsInfo?.dsid;
    return id == null ? undefined : String(id);
  }

  /**
   * Re-run accountLogin with stored session token to refresh webauth cookies.
   * Needed for older sessions created without extended_login.
   */
  async refreshCloudCookies(): Promise<boolean> {
    if (!this.sessionToken) return false;
    const setupRes = await fetch(SETUP_ENDPOINT, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        accountCountryCode: this.accountCountry,
        dsWebAuthToken: this.sessionToken,
        extended_login: true,
        trustToken: this.trustToken,
      }),
    });
    if (!setupRes.ok) return false;
    this.absorbCookies(setupRes);
    try {
      this.accountInfo = (await setupRes.json()) as ICloudAccountInfo & {
        termsUpdateNeeded?: boolean;
      };
    } catch {
      // keep previous accountInfo
    }
    assertUsableWebSession(this);
    this.status = "ready";
    return true;
  }

  /**
   * Acquire PCS cookies required by Photos / Drive when Apple marks pcsRequired.
   * May need approval on a trusted Apple device (poll briefly).
   */
  async ensurePcsAccess(appName: "photos" | "iclouddrive"): Promise<boolean> {
    const needed =
      appName === "photos"
        ? ["X-APPLE-WEBAUTH-PCS-Photos", "X-APPLE-WEBAUTH-PCS-Sharing"]
        : ["X-APPLE-WEBAUTH-PCS-Documents"];
    const wsKey = appName === "photos" ? "ckdatabasews" : "drivews";
    const ws = this.accountInfo?.webservices?.[wsKey];
    if (!ws?.pcsRequired) return false;
    if (needed.every((name) => this.hasCookie(name))) return false;

    // Existing sessions may lack WEBAUTH-TOKEN; refresh once before PCS.
    if (!this.hasCookie("X-APPLE-WEBAUTH-TOKEN")) {
      await this.refreshCloudCookies();
    }

    await fetch("https://setup.icloud.com/setup/ws/1/requestWebAccessState", {
      method: "POST",
      headers: this.apiHeaders(),
      body: "{}",
    }).catch(() => undefined);

    // ponytail: poll ~30s; ADP device-approval can take longer if user is AFK.
    for (let i = 0; i < 6; i++) {
      const res = await fetch(
        "https://setup.icloud.com/setup/ws/1/requestPCS",
        {
          method: "POST",
          headers: this.apiHeaders(),
          body: JSON.stringify({
            appName,
            derivedFromUserAction: i === 0,
          }),
        },
      );
      this.absorbCookies(res);
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        message?: string;
        error?: string;
      } | null;
      if (needed.every((name) => this.hasCookie(name))) return true;
      if (json?.status === "success") {
        if (needed.every((name) => this.hasCookie(name))) return true;
      }
      // Account without ADP/ICDRS disabled — Apple rejects requestPCS; cookies from login are enough.
      const msg = `${json?.message ?? ""} ${json?.error ?? ""}`;
      if (/not disabled iCloud DRS/i.test(msg)) {
        return false;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (!needed.every((name) => this.hasCookie(name))) {
      throw new Error(
        "Approve iCloud web access on your Apple device, then Sync again.",
      );
    }
    return true;
  }
}

function getSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCookie(raw: string): {
  name: string;
  value: string;
  expired: boolean;
} | null {
  const first = raw.split(";")[0] ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  let value = first.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  const attrs = raw.toLowerCase();
  const expired =
    !value ||
    attrs.includes("expires=thu, 01-jan-1970") ||
    attrs.includes("expires=thu, 1-jan-1970") ||
    /max-age=0\b/.test(attrs);
  return { name, value, expired };
}

function assertUsableWebSession(client: ICloudClient) {
  const info = client.accountInfo as
    | (ICloudAccountInfo & {
        termsUpdateNeeded?: boolean;
        dsInfo?: { isWebAccessAllowed?: boolean };
      })
    | null;
  if (info?.termsUpdateNeeded) {
    throw new Error(
      "Open icloud.com in a browser, sign in, and accept the iCloud Terms. Then disconnect and reconnect this Apple account.",
    );
  }
  if (info?.dsInfo?.isWebAccessAllowed === false) {
    throw new Error(
      "Turn on Settings → [Your Name] → iCloud → Access iCloud Data on the Web, then reconnect.",
    );
  }
  if (!client.hasCookie("X-APPLE-WEBAUTH-TOKEN")) {
    throw new Error(
      "Apple did not issue a web session token. Open icloud.com, accept any Terms prompt, confirm web access is on, then reconnect.",
    );
  }
}
