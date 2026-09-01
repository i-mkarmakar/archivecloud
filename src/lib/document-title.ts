import { APP_NAME } from "@/lib/site-metadata";

export function formatDocumentTitle(page: string) {
  return `${page} - ${APP_NAME}`;
}

export function setDocumentTitle(page: string) {
  if (typeof document !== "undefined") {
    document.title = formatDocumentTitle(page);
  }
}
