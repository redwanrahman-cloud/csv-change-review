import { lazy, Suspense } from "react";
import { useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";

import { PageLoading } from "@/components/deferred-pages/PageLoading";

const DeferredPage = lazy(() => import("@/components/deferred-pages/DatabasePage"));

export function meta() {
  return [{ title: "Database" }];
}

export default function DatabasePage() {
  const t = useT();
  useSetPageTitle(t("pages.databaseTitle"));
  return (
    <Suspense fallback={<PageLoading />}>
      <DeferredPage />
    </Suspense>
  );
}
