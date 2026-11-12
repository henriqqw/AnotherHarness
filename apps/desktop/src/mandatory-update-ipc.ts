/** Dependency-free IPC names shared with the sandboxed mandatory-update preload. */
export const MANDATORY_IPC = {
  status: 'ah-desktop:mandatory-status', state: 'ah-desktop:mandatory-state', action: 'ah-desktop:mandatory-action',
} as const
