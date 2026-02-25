export type WalletType = 'freighter' | 'albedo' | 'xbull' | 'rabet';

export interface WalletInfo {
  type: WalletType;
  publicKey: string;
  network: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletError {
  type: 'not_found' | 'connection_failed' | 'wrong_network' | 'user_rejected';
  message: string;
}
