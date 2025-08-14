"use client";
import { useEffect, useRef, useState } from "react";

export default function InView({ children, className = "" }:{
  children: React.ReactNode; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setOn(true);
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} ${on ? 'animate-fade-up' : 'opacity-0 translate-y-1'}`}
    >
      {children}
    </div>
  );
}
