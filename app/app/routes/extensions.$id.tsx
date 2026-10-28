import { lazy, Suspense } from "react";

import { PageLoading } from "@/components/deferred-pages/PageLoading";
import { APP_TITLE } from "@/lib/app-config";

const DeferredPage = lazy(() => import("@/components/deferred-pages/ExtensionPage"));

export function meta() {
  return [{ title: `Extension — ${APP_TITLE}` }];
}

export default function ExtensionViewerRoute() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DeferredPage />
    </Suspense>
  );
}
