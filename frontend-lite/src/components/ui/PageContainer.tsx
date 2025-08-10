"use client";
import React from "react";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  fullscreen?: boolean;
}

// Lightweight clone of the Storybook PageContainer for frontend-lite
export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className = "", children, padded = true, fullscreen = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200",
          fullscreen ? "min-h-screen" : "",
          padded ? "p-4 sm:p-6 md:p-8" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PageContainer.displayName = "PageContainer";

export default PageContainer;
