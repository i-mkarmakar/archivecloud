"use client";
import { use } from "react";
import { PublicFilePage } from "@/views/PublicFilePage";
export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <PublicFilePage token={token} />;
}
