function LoadingCard() {
  return (
    <div className="surface-panel rounded-[20px] p-5 md:p-6">
      <div className="h-3 w-32 rounded-full bg-slate-200" />
      <div className="mt-4 h-7 w-56 rounded-full bg-slate-200" />
      <div className="mt-3 h-4 w-full max-w-[520px] rounded-full bg-slate-100" />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="h-20 rounded-[14px] bg-slate-100" />
        <div className="h-20 rounded-[14px] bg-slate-100" />
        <div className="h-20 rounded-[14px] bg-slate-100" />
      </div>
    </div>
  );
}

export default function IntegrationsLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading integrations">
      <div className="surface-panel rounded-[24px] p-5 md:p-6">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-64 max-w-full rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full rounded-full bg-slate-100" />
      </div>
      <LoadingCard />
      <LoadingCard />
    </div>
  );
}
