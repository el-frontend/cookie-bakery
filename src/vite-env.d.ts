/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_DAS_URL?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_BRIDGE_URL?: string;
  readonly VITE_WALLET_CHAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
