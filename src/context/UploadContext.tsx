"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { API_URL, apiFetch } from "@/lib/api";

export type UploadProgressStatus = "uploading" | "done" | "error" | "partial";
export type UploadProgressFile = {
  name: string;
  size: number;
  percent: number;
  status: UploadProgressStatus;
};
export type UploadProgressState = {
  open: boolean;
  fileName: string;
  percent: number;
  status: UploadProgressStatus;
  files: UploadProgressFile[];
};

export type UploadRoutingOptions = {
  targetAccountId?: string | null;
  /** When Ask Every Time is on, user chose Smart File Distribution for this upload. */
  useSmartDistribution?: boolean;
};

type ResumableSession = {
  sessionId: string;
  file: File;
  folderId?: string | null;
  targetAccountId?: string | null;
  useSmartDistribution?: boolean;
};

type UploadContextType = {
  uploadProgress: UploadProgressState;
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgressState>>;
  uploadFiles: (
    files: File[],
    folderId: string | null,
    routing?: UploadRoutingOptions | string | null,
  ) => Promise<void>;
  retryFailedUpload: (fileName: string) => Promise<void>;
};

const UploadContext = createContext<UploadContextType | undefined>(undefined);

function normalizeRouting(
  routing?: UploadRoutingOptions | string | null,
): UploadRoutingOptions {
  if (routing == null) return {};
  if (typeof routing === "string") return { targetAccountId: routing };
  return routing;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    open: false,
    fileName: "",
    percent: 0,
    status: "uploading",
    files: [],
  });
  const [resumableSessions, setResumableSessions] = useState<
    Record<string, ResumableSession>
  >({});

  async function uploadMultipartFile(
    file: File,
    folderId: string | null,
    onProgress: (percent: number) => void,
    routing: UploadRoutingOptions,
    accountId?: string,
  ) {
    const form = new FormData();
    form.append("sizeBytes", String(file.size));
    form.append("fileName", file.name);
    form.append("mimeType", file.type || "application/octet-stream");
    if (folderId) form.append("folderId", folderId);
    if (accountId || routing.targetAccountId) {
      form.append(
        "targetAccountId",
        accountId || routing.targetAccountId || "",
      );
    }
    if (routing.useSmartDistribution) {
      form.append("useSmartDistribution", "true");
    }
    form.append("file-0", file, file.name);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/uploads`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
          return;
        }
        let message = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(form);
    });
  }

  async function uploadSingleFileResumable(
    file: File,
    folderId: string | null,
    onProgress: (percent: number) => void,
    sessionIdToRetry?: string,
    routing: UploadRoutingOptions = {},
  ) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (must be multiple of 256KB for Google Drive)
    let sessionId = sessionIdToRetry || "";
    let startOffset = 0;

    setResumableSessions((prev) => ({
      ...prev,
      [file.name]: {
        sessionId,
        file,
        folderId,
        targetAccountId: routing.targetAccountId,
        useSmartDistribution: routing.useSmartDistribution,
      },
    }));

    if (!sessionId) {
      const initData = await apiFetch<{
        sessionId?: string;
        provider?: string;
        uploadMode?: "multipart";
        accountId?: string;
      }>("/uploads/resumable/init", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: String(file.size),
          folderId: folderId || undefined,
          targetAccountId: routing.targetAccountId || undefined,
          useSmartDistribution: routing.useSmartDistribution || undefined,
        }),
      });

      if (initData.uploadMode === "multipart") {
        await uploadMultipartFile(
          file,
          folderId,
          onProgress,
          routing,
          initData.accountId,
        );
        return;
      }

      sessionId = initData.sessionId || "";
      if (!sessionId) throw new Error("Upload session was not created.");
      setResumableSessions((prev) => ({
        ...prev,
        [file.name]: {
          sessionId,
          file,
          folderId,
          targetAccountId: routing.targetAccountId,
          useSmartDistribution: routing.useSmartDistribution,
        },
      }));
    } else {
      const statusData = await apiFetch<{ status: string; offset: string }>(
        `/uploads/resumable/status/${sessionId}`,
      );
      startOffset = Number(statusData.offset);
      if (statusData.status === "completed") {
        onProgress(100);
        return;
      }
    }

    while (startOffset < file.size) {
      const endOffset = Math.min(startOffset + CHUNK_SIZE, file.size);
      const chunk = file.slice(startOffset, endOffset);

      const response = await fetch(
        `${API_URL}/uploads/resumable/chunk/${sessionId}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: {
            "Content-Range": `bytes ${startOffset}-${endOffset - 1}/${file.size}`,
            "Content-Length": String(chunk.size),
          },
          body: chunk,
        },
      );

      if (!response.ok) {
        throw new Error("Chunk upload failed");
      }

      const resData = (await response.json()) as {
        status: string;
        offset?: string;
      };
      if (resData.status === "completed") {
        onProgress(100);
        break;
      }

      startOffset = Number(resData.offset);
      const percent = Math.min(99, Math.round((startOffset / file.size) * 100));
      onProgress(percent);
    }
  }

  async function uploadFiles(
    filesToUpload: File[],
    targetFolderId: string | null,
    routing?: UploadRoutingOptions | string | null,
  ) {
    if (filesToUpload.length === 0) return;
    const options = normalizeRouting(routing);

    setUploadProgress({
      open: true,
      fileName:
        filesToUpload.length === 1
          ? filesToUpload[0].name
          : `${filesToUpload.length} files`,
      percent: 0,
      status: "uploading",
      files: filesToUpload.map((f) => ({
        name: f.name,
        size: f.size,
        percent: 0,
        status: "uploading",
      })),
    });

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        await uploadSingleFileResumable(
          file,
          targetFolderId,
          (filePercent) => {
            setUploadProgress((current) => {
              const nextFiles = [...current.files];
              if (nextFiles[i]) {
                nextFiles[i] = {
                  ...nextFiles[i],
                  percent: filePercent,
                  status: filePercent >= 100 ? "done" : "uploading",
                };
              }
              const overallPercent = Math.round(
                nextFiles.reduce((sum, f) => sum + f.percent, 0) /
                  nextFiles.length,
              );
              return {
                ...current,
                percent: overallPercent,
                files: nextFiles,
              };
            });
          },
          undefined,
          options,
        );
      } catch (err) {
        console.error("File upload failed:", file.name, err);
        setUploadProgress((current) => {
          const nextFiles = [...current.files];
          if (nextFiles[i]) {
            nextFiles[i] = { ...nextFiles[i], status: "error" };
          }
          return {
            ...current,
            status: "partial",
            files: nextFiles,
          };
        });
      }
    }

    window.dispatchEvent(new Event("archivecloud:storage-changed"));
    window.dispatchEvent(new Event("archivecloud:upload-completed"));
  }

  async function retryFailedUpload(fileName: string) {
    const session = resumableSessions[fileName];
    if (!session) return;

    setUploadProgress((current) => {
      const nextFiles = current.files.map((f) =>
        f.name === fileName ? { ...f, status: "uploading" as const } : f,
      );
      return {
        ...current,
        status: "uploading",
        files: nextFiles,
      };
    });

    try {
      const fileIndex = uploadProgress.files.findIndex(
        (f) => f.name === fileName,
      );
      await uploadSingleFileResumable(
        session.file,
        session.folderId || null,
        (filePercent) => {
          setUploadProgress((current) => {
            const nextFiles = [...current.files];
            if (nextFiles[fileIndex]) {
              nextFiles[fileIndex] = {
                ...nextFiles[fileIndex],
                percent: filePercent,
                status: filePercent >= 100 ? "done" : "uploading",
              };
            }
            const overallPercent = Math.round(
              nextFiles.reduce((sum, f) => sum + f.percent, 0) /
                nextFiles.length,
            );
            const allDone = nextFiles.every((f) => f.status === "done");
            return {
              ...current,
              percent: overallPercent,
              status: allDone ? "done" : "uploading",
              files: nextFiles,
            };
          });
        },
        session.sessionId || undefined,
        {
          targetAccountId: session.targetAccountId,
          useSmartDistribution: session.useSmartDistribution,
        },
      );

      window.dispatchEvent(new Event("archivecloud:storage-changed"));
      window.dispatchEvent(new Event("archivecloud:upload-completed"));
    } catch (err) {
      console.error("Retry upload failed:", fileName, err);
      setUploadProgress((current) => {
        const nextFiles = current.files.map((f) =>
          f.name === fileName ? { ...f, status: "error" as const } : f,
        );
        return {
          ...current,
          status: "partial",
          files: nextFiles,
        };
      });
    }
  }

  return (
    <UploadContext.Provider
      value={{
        uploadProgress,
        setUploadProgress,
        uploadFiles,
        retryFailedUpload,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
