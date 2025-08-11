"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy route – redirect to /kp

export default function KBPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/kp");
  }, [router]);
  return null;
}
