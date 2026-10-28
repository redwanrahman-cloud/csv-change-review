import { lazy, Suspense } from "react";
import { useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";

import { PageLoading } from "@/components/deferred-pages/PageLoading";
import enUS from "@/i18n/en-US";

const DeferredPage = lazy(() => import("@/components/deferred-pages/ObservabilityPage"));

export function meta() {
  return [{ title: enUS.pages.observabilityPageTitle }];
}

export default function ObservabilityPage() {
  const t = useT();
  useSetPageTitle(t("pages.observabilityPageTitle"));
  return (
    <Suspense fallback={<PageLoading />}>
      <DeferredPage />
    </Suspense>
  );
}
