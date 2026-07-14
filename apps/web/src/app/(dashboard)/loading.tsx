function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-slate-200/80 ${className}`} />;
}

function SkeletonPanel({ tall = false }: { tall?: boolean }) {
  return (
    <div className="surface-panel rounded-[20px] p-5 md:p-6">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="mt-4 h-7 w-2/3 max-w-[360px]" />
      <SkeletonLine className="mt-3 h-4 w-full max-w-[520px]" />
      <SkeletonLine className="mt-2 h-4 w-4/5 max-w-[460px]" />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-[16px] bg-slate-100" />
        <div className="h-20 rounded-[16px] bg-slate-100" />
        <div className="h-20 rounded-[16px] bg-slate-100" />
      </div>

      {tall ? (
        <div className="mt-5 space-y-3">
          <div className="h-16 rounded-[16px] bg-slate-100" />
          <div className="h-16 rounded-[16px] bg-slate-100" />
          <div className="h-16 rounded-[16px] bg-slate-100" />
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading page">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <SkeletonPanel />
        <SkeletonPanel />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="h-28 rounded-[20px] border border-border bg-white shadow-[var(--shadow-card)]" />
        <div className="h-28 rounded-[20px] border border-border bg-white shadow-[var(--shadow-card)]" />
        <div className="h-28 rounded-[20px] border border-border bg-white shadow-[var(--shadow-card)]" />
        <div className="h-28 rounded-[20px] border border-border bg-white shadow-[var(--shadow-card)]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SkeletonPanel tall />
        <SkeletonPanel tall />
      </div>
    </div>
  );
}
