import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "react-router"],
  },
  environments: {
    nitro: {
      optimizeDeps: {
        // Bound the observed native client-barrel evaluation to one prebundle.
        noDiscovery: true,
        include: ["@agent-native/agentkit/client"],
      },
    },
  },
  optimizeDeps: {
    entries: [
      "app/entry.client.tsx",
      "app/root.tsx",
      "app/components/layout/{Layout,Sidebar}.tsx",
      "app/components/chat/ChatRouteContent.tsx",
      "app/routes/{home,chat.$threadId}.tsx",
    ],
  },
  plugins: [
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      nitro: {
        noExternals: [
          "@agent-native/core",
          "@agent-native/toolkit",
          "@agent-native/agentkit",
        ],
      },
      ssrStubs: ["shiki"],
    }),
  ],
});
