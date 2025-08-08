"use client";

export function PreviewPane({ url }: { url: string }) {
  return (
    <div className="pane preview">
      <iframe src={url} title="Preview" />
    </div>
  );
}
