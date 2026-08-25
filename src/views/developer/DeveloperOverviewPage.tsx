"use client";

import { Button, Card } from "@heroui/react";
import { Cloud, CurlyBrackets, Speedometer, Terminal } from "@gravity-ui/icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch } from "@/lib/api";

export function DeveloperOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    apiKeys: 0,
    accounts: 0,
    auditLogs: 0,
  });

  useEffect(() => {
    Promise.all([
      apiFetch<{ apiKeys: { status: string }[] }>("/api-keys").catch(() => ({
        apiKeys: [],
      })),
      apiFetch<{ accounts: unknown[] }>("/connected-accounts").catch(() => ({
        accounts: [],
      })),
      apiFetch<{ logs: unknown[] }>("/audit-logs?limit=100").catch(() => ({
        logs: [],
      })),
    ]).then(([keys, accounts, logs]) => {
      setStats({
        apiKeys: keys.apiKeys.filter((k) => k.status === "active").length,
        accounts: accounts.accounts.length,
        auditLogs: logs.logs.length,
      });
    });
  }, []);

  const links = [
    {
      title: "API Keys",
      description: "Create keys and upload via the external API.",
      href: "/developer/api",
      icon: CurlyBrackets,
    },
    {
      title: "Storage & routing",
      description: "Quota breakdown and upload routing across accounts.",
      href: "/developer/storage",
      icon: Speedometer,
    },
    {
      title: "Providers",
      description: "Configure Google OAuth credentials for Drive connect.",
      href: "/developer/providers",
      icon: Cloud,
    },
    {
      title: "Operations",
      description: "System update, database backup, and restore.",
      href: "/developer/ops",
      icon: Terminal,
    },
  ];

  return (
    <>
      <PageHeader
        title="Developer Console"
        description="Integrate with ArchiveCloud, manage providers, and operate your instance."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-2xl font-extrabold">{stats.apiKeys}</p>
          <p className="text-sm text-muted">Active API keys</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-extrabold">{stats.accounts}</p>
          <p className="text-sm text-muted">Connected storage accounts</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-extrabold">{stats.auditLogs}</p>
          <p className="text-sm text-muted">Recent audit events</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {links.map((item) => (
          <Card key={item.href} className="p-5">
            <item.icon className="h-5 w-5 text-foreground" />
            <h2 className="mt-3 font-extrabold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted">{item.description}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onPress={() => router.push(item.href)}
            >
              Open
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
