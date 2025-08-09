"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { KiffCreatePage } from "@/components/kiffs/KiffCreatePage";

export default function KiffsCreatePage() {
  const router = useRouter();

  const handleCreate = React.useCallback(() => {
    // Placeholder: route to a future Kiff composer or show a toast
    router.push("/kiffs/compose");
  }, [router]);

  return <KiffCreatePage mode="light" onCreate={handleCreate} />;
}
