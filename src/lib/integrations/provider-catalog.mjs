const PROVIDERS = [
  {
    id: "google-drive",
    name: "Google Drive",
    category: "files",
    description: "Find, read and organize files after the account owner grants access.",
    requestedScopes: ["drive.file"],
    connectionMethod: "oauth",
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "email",
    description: "Search messages and prepare email drafts with explicit approval before sending.",
    requestedScopes: ["gmail.readonly", "gmail.compose"],
    connectionMethod: "oauth",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    description: "Review availability and prepare calendar changes for approval.",
    requestedScopes: ["calendar.events.readonly"],
    connectionMethod: "oauth",
  },
  {
    id: "github",
    name: "GitHub",
    category: "development",
    description: "Inspect repositories, issues and pull requests using least-privilege access.",
    requestedScopes: ["metadata:read", "contents:read"],
    connectionMethod: "oauth",
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Search approved workspace conversations and prepare messages for review.",
    requestedScopes: ["search:read", "chat:write"],
    connectionMethod: "oauth",
  },
  {
    id: "notion",
    name: "Notion",
    category: "knowledge",
    description: "Search connected knowledge pages and prepare page updates for approval.",
    requestedScopes: ["search:read", "pages:read"],
    connectionMethod: "oauth",
  },
].map((provider) => Object.freeze({
  ...provider,
  status: "planned",
  externalActionsEnabled: false,
  requiresFreshApproval: true,
}));

export function listIntegrationProviders({ category } = {}) {
  return PROVIDERS
    .filter((provider) => !category || provider.category === category)
    .map((provider) => ({ ...provider, requestedScopes: [...provider.requestedScopes] }));
}

export function getIntegrationProvider(providerId) {
  const provider = PROVIDERS.find((item) => item.id === providerId);
  return provider ? { ...provider, requestedScopes: [...provider.requestedScopes] } : null;
}
