export function serializeStorageAccount(storageAccount: {
  id: string;
  connectedAccountId: string;
  totalBytes: bigint | null;
  usedBytes: bigint;
  availableBytes: bigint | null;
  trashBytes: bigint | null;
  photoBytes: bigint;
  videoBytes: bigint;
  documentBytes: bigint;
  breakdownSyncedAt: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...storageAccount,
    totalBytes: storageAccount.totalBytes?.toString() ?? null,
    usedBytes: storageAccount.usedBytes.toString(),
    availableBytes: storageAccount.availableBytes?.toString() ?? null,
    trashBytes: storageAccount.trashBytes?.toString() ?? null,
    photoBytes: storageAccount.photoBytes.toString(),
    videoBytes: storageAccount.videoBytes.toString(),
    documentBytes: storageAccount.documentBytes.toString(),
  };
}
