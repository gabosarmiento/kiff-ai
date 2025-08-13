"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PreviewPane({
  previewUrl,
  className,
}: {
  previewUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={className || "h-full"}>
      <Card className="h-full">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-48px)]">
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Preview not ready yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
