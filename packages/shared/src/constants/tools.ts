export interface ToolRegistryEntry {
  id: string;
  nameKey: string;
  path: string;
}

export const TOOL_LIST: ToolRegistryEntry[] = [
  {
    id: 'money-tracker',
    nameKey: 'shell.tools.moneyTracker',
    path: '/',
  },
];
