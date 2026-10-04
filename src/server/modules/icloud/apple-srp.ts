import "server-only";

import { Hash, Mode, Srp, util as srpUtil } from "@foxt/js-srp";
import crypto from "node:crypto";

const srp = new Srp(Mode.GSA, Hash.SHA256, 2048);

function stringToU8Array(str: string) {
  return new TextEncoder().encode(str);
}

function base64ToU8Array(str: string) {
  return Uint8Array.from(Buffer.from(str, "base64"));
}

export type SrpInitPayload = {
  a: string;
  protocols: string[];
  accountName: string;
};

export type SrpServerData = {
  protocol: string;
  salt: string;
  b: string;
  iteration: number;
  c: string;
};

export type SrpCompletePayload = {
  accountName: string;
  m1: string;
  m2: string;
  c: string;
};

/** Apple GSA SRP-6a helper (same protocol iCloud.com uses). */
export class AppleSrpAuthenticator {
  private srpClient: Awaited<ReturnType<Srp["newClient"]>> | undefined;

  constructor(private username: string) {}

  private async derivePassword(
    protocol: string,
    password: string,
    salt: Uint8Array,
    iterations: number,
  ) {
    let passHash = new Uint8Array(
      await srpUtil.hash(srp.h, stringToU8Array(password).buffer),
    );
    if (protocol === "s2k_fo") {
      passHash = stringToU8Array(srpUtil.toHex(passHash));
    }
    const imported = await crypto.subtle.importKey(
      "raw",
      passHash,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: { name: "SHA-256" },
        iterations,
        salt,
      },
      imported,
      256,
    );
    return new Uint8Array(derived);
  }

  async getInit(): Promise<SrpInitPayload> {
    if (this.srpClient) throw new Error("Already initialized");
    this.srpClient = await srp.newClient(
      stringToU8Array(this.username),
      new Uint8Array(),
    );
    const a = Buffer.from(srpUtil.bytesFromBigint(this.srpClient.A)).toString(
      "base64",
    );
    return {
      a,
      protocols: ["s2k", "s2k_fo"],
      accountName: this.username,
    };
  }

  async getComplete(
    password: string,
    serverData: SrpServerData,
  ): Promise<SrpCompletePayload> {
    if (!this.srpClient) throw new Error("Not initialized");
    if (serverData.protocol !== "s2k" && serverData.protocol !== "s2k_fo") {
      throw new Error(`Unsupported protocol ${serverData.protocol}`);
    }
    const salt = base64ToU8Array(serverData.salt);
    const serverPub = base64ToU8Array(serverData.b);
    const derived = await this.derivePassword(
      serverData.protocol,
      password,
      salt,
      serverData.iteration,
    );
    this.srpClient.p = derived;
    await this.srpClient.generate(salt, serverPub);
    const m1 = Buffer.from(this.srpClient._M).toString("base64");
    const M2 = await this.srpClient.generateM2();
    const m2 = Buffer.from(M2).toString("base64");
    return {
      accountName: this.username,
      m1,
      m2,
      c: serverData.c,
    };
  }
}
