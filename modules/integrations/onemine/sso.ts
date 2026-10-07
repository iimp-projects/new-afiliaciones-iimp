import { createHash } from "node:crypto";

const ONEMINE_ORGANIZATION = "instituto-de-ingenieros-de-minas-del-per-";
const ONEMINE_SSO_ENDPOINT = `https://www.onemine.org/sso/${ONEMINE_ORGANIZATION}`;

function formatTimestamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`;
}

export function createOneMineSsoUrl(secret: string, now = new Date()): URL {
  if (!secret.trim()) {
    throw new Error("La clave SSO de OneMine no está configurada.");
  }

  // OneMine's legacy contract has no individual subject or nonce. A generated
  // URL can be replayed within the timestamp window accepted by OneMine;
  // reducing that window requires coordination with the provider.
  const timestamp = formatTimestamp(now);
  const secureCode = createHash("md5")
    .update(`${ONEMINE_ORGANIZATION}${timestamp}${secret}`)
    .digest("base64");
  const url = new URL(ONEMINE_SSO_ENDPOINT);
  url.searchParams.set("ts", timestamp);
  url.searchParams.set("secureCode", secureCode);

  return url;
}
