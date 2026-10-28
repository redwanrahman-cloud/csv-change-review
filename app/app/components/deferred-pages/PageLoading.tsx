import { useT } from "@agent-native/core/client/i18n";

/** Route-local placeholder; the persistent shell remains above the Outlet. */
export function PageLoading() {
  const t = useT();
  return (
    <div className="h-full min-h-64 p-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="min-h-48 rounded border border-border" />
      </div>
    </div>
  );
}
