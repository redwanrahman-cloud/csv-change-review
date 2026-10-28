import { lazy, Suspense } from "react";
import { useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";

import { PageLoading } from "@/components/deferred-pages/PageLoading";
import { APP_TITLE } from "@/lib/app-config";

const DeferredPage = lazy(() => import("@/components/deferred-pages/SettingsPage"));

export function meta() {
  return [{ title: `Settings - ${APP_TITLE}` }];
}

export default function SettingsRoute() {
  const t = useT();
  useSetPageTitle(t("settings.title"));
  return (
    <Suspense fallback={<PageLoading />}>
      <DeferredPage />
    </Suspense>
  );
}
