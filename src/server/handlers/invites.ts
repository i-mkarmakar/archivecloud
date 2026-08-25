import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor"]).default("viewer"),
  targetType: z.enum(["file", "folder"]),
  targetId: z.string().min(1),
});

type InviteRecord = {
  id: string;
  inviterId: string;
  inviteeEmail: string;
  targetType: string;
  targetId: string;
  role: string;
  status: string;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type TargetRecord = {
  id: string;
  name: string;
  type: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
  folderId?: string | null;
};

async function assertTargetOwner(
  userId: string,
  targetType: string,
  targetId: string,
) {
  if (targetType === "file")
    return prisma.file.findFirstOrThrow({
      where: { id: targetId, userId, status: "active" },
    });
  return prisma.folder.findFirstOrThrow({
    where: { id: targetId, userId, deletedAt: null },
  });
}

async function resolveTargets(invites: InviteRecord[]) {
  const fileIds = invites
    .filter((invite) => invite.targetType === "file")
    .map((invite) => invite.targetId);
  const folderIds = invites
    .filter((invite) => invite.targetType === "folder")
    .map((invite) => invite.targetId);
  const [files, folders] = await Promise.all([
    prisma.file.findMany({
      where: { id: { in: fileIds }, status: "active" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        folderId: true,
      },
    }),
    prisma.folder.findMany({
      where: { id: { in: folderIds }, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  const targets = new Map<string, TargetRecord>();
  for (const file of files)
    targets.set(`file:${file.id}`, {
      id: file.id,
      name: file.name,
      type: "file",
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      folderId: file.folderId,
    });
  for (const folder of folders)
    targets.set(`folder:${folder.id}`, {
      id: folder.id,
      name: folder.name,
      type: "folder",
    });
  return targets;
}

function serializeInvite(
  invite: InviteRecord,
  target: TargetRecord | null,
  user?: { id: string; name: string; email: string } | null,
) {
  return {
    id: invite.id,
    email: invite.inviteeEmail,
    role: invite.role,
    status: invite.status,
    targetType: invite.targetType,
    targetId: invite.targetId,
    target,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
    user: user ?? null,
  };
}

export async function listInvitesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true },
  });
  const [sent, received] = await Promise.all([
    prisma.workspaceInvite.findMany({
      where: { inviterId: user.id, revokedAt: null, targetId: { not: "" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceInvite.findMany({
      where: { inviteeEmail: me.email, revokedAt: null, targetId: { not: "" } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const allInvites = [...sent, ...received];
  const emails = [...new Set(sent.map((invite) => invite.inviteeEmail))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, name: true, email: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const acceptedInvites = sent.filter(
    (invite) =>
      invite.status === "pending" && userByEmail.has(invite.inviteeEmail),
  );
  if (acceptedInvites.length > 0)
    await prisma.workspaceInvite.updateMany({
      where: { id: { in: acceptedInvites.map((invite) => invite.id) } },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  const targetByKey = await resolveTargets(allInvites);
  const sentInvites = sent.map((invite) =>
    serializeInvite(
      {
        ...invite,
        status: userByEmail.has(invite.inviteeEmail)
          ? "accepted"
          : invite.status,
        acceptedAt: userByEmail.has(invite.inviteeEmail)
          ? (invite.acceptedAt ?? new Date())
          : invite.acceptedAt,
      },
      targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null,
      userByEmail.get(invite.inviteeEmail),
    ),
  );
  const receivedInvites = received.map((invite) =>
    serializeInvite(
      invite,
      targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null,
    ),
  );
  return json({
    sent: sentInvites,
    received: receivedInvites,
    invites: sentInvites,
  });
}

export async function createInviteHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = inviteSchema.parse(await request.json());
  const email = body.email.trim().toLowerCase();
  const inviter = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true },
  });
  if (email === inviter.email)
    return errorJson(
      "INVITE_SELF_NOT_ALLOWED",
      "You cannot invite yourself.",
      400,
    );
  await assertTargetOwner(user.id, body.targetType, body.targetId);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  const invite = await prisma.workspaceInvite.upsert({
    where: {
      inviterId_inviteeEmail_targetType_targetId: {
        inviterId: user.id,
        inviteeEmail: email,
        targetType: body.targetType,
        targetId: body.targetId,
      },
    },
    create: {
      inviterId: user.id,
      inviteeEmail: email,
      role: body.role,
      targetType: body.targetType,
      targetId: body.targetId,
      status: existingUser ? "accepted" : "pending",
      acceptedAt: existingUser ? new Date() : null,
    },
    update: {
      role: body.role,
      status: existingUser ? "accepted" : "pending",
      acceptedAt: existingUser ? new Date() : null,
      revokedAt: null,
    },
  });
  const targetByKey = await resolveTargets([invite]);
  return json(
    {
      invite: serializeInvite(
        invite,
        targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null,
        existingUser,
      ),
    },
    201,
  );
}

export async function deleteInviteHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("INVITE_NOT_FOUND", "Invite not found.", 404);
  const result = await prisma.workspaceInvite.updateMany({
    where: { id, inviterId: user.id, revokedAt: null },
    data: { status: "revoked", revokedAt: new Date() },
  });
  if (result.count === 0)
    return errorJson("INVITE_NOT_FOUND", "Invite not found.", 404);
  return json({ status: "ok" });
}
