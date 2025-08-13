"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy route – redirect to /kiffs/packs

export default function KBPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/kiffs/packs");
  }, [router]);
  return null;
}
