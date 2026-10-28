import {
  AccountSettingsCard,
  SettingsTabsPage,
  useAgentSettingsTabs,
} from "@agent-native/toolkit/app/settings";

import changelog from "../../../CHANGELOG.md?raw";

// Chat has no app rows here: core Preferences owns the interface language.

export default function SettingsPage() {
  const agentSettingsTabs = useAgentSettingsTabs();

  return (
    <SettingsTabsPage
      account={<AccountSettingsCard />}
      extraTabs={agentSettingsTabs}
      whatsNewMarkdown={changelog}
    />
  );
}
