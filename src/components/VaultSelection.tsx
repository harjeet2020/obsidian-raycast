import { ObsidianVault } from "@/obsidian";
import { Action, ActionPanel, List } from "@raycast/api";
import { ShowVaultInFinderAction, CopyVaultPathAction, SetVaultNicknameAction, ClearVaultNicknameAction } from "../utils/actions";
import { useVaultNicknames } from "../utils/hooks";

export function VaultSelection(props: { vaults: ObsidianVault[]; target: (vault: ObsidianVault) => React.ReactNode }) {
  const { vaults, target } = props;
  const { nicknames, setNickname, clearNickname } = useVaultNicknames();

  return (
    <List>
      {vaults?.map((vault) => (
        <List.Item
          title={nicknames[vault.path] ??vault.name}
          subtitle={vault.path}
          key={vault.key}
          actions={
            <ActionPanel>
              <Action.Push title="Select Vault" target={target(vault)} />
              <ShowVaultInFinderAction vault={vault} />
              <CopyVaultPathAction vault={vault} />
              <SetVaultNicknameAction vault={vault} currentNickname={nicknames[vault.path]} onSet={setNickname} />
              {nicknames[vault.path] && <ClearVaultNicknameAction vault={vault} onClear={clearNickname} />}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
