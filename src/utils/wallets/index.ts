import type { WalletType } from '../../types/wallet';
import { albedoAdapter } from './albedo';
import { freighterAdapter } from './freighter';
import { rabetAdapter } from './rabet';
import { xbullAdapter } from './xbull';
import type { WalletAdapter } from './types';

export const walletAdapters: Record<WalletType, WalletAdapter> = {
  freighter: freighterAdapter,
  albedo: albedoAdapter,
  xbull: xbullAdapter,
  rabet: rabetAdapter,
};

export const getWalletAdapter = (type: WalletType): WalletAdapter | undefined =>
  walletAdapters[type];
