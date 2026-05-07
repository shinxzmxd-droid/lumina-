import { useScrollReveal, useCountUp } from "@/hooks/useReveal";
import { ReactNode } from "react";

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CountUp({ value, duration = 1200, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const v = useCountUp(value, duration);
  return <>{v.toLocaleString()}{suffix}</>;
}

export function FloatingBlobs({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="blob blob-lavender w-72 h-72 -top-10 -left-10" />
      <div className="blob blob-pink w-80 h-80 top-1/3 right-0 animate-blob-slow" style={{ animationDelay: "-4s" }} />
      <div className="blob blob-mint w-64 h-64 bottom-0 left-1/3" style={{ animationDelay: "-8s" }} />
    </div>
  );
}
