
import type { DutchAuction } from '../types/dutchAuction';

const now = Date.now();

export const MOCK_DUTCH_AUCTIONS: DutchAuction[] = [
  {
    id: 'DA-001',
    nft: {
      id: 'NFT-001',
      name: 'Cosmic Ape #1234',
      description: 'A rare cosmic ape from the Ape Universe collection',
      image: '/nft/cosmic-ape.svg',
      collection: 'Ape Universe',
      tokenId: '1234',
    },
    seller: 'GABCDEF...12345',
    startPrice: 1000,
    floorPrice: 200,
    startTime: new Date(now - 3600000).toISOString(), // started 1 hour ago
    endTime: new Date(now + 7200000).toISOString(), // ends in 2 hours
    duration: 10800, // 3 hours total
    status: 'Active',
  },
  {
    id: 'DA-002',
    nft: {
      id: 'NFT-002',
      name: 'Digital Dragon #567',
      description: 'A fierce digital dragon with glowing scales',
      image: '/nft/digital-dragon.svg',
      collection: 'Mythic Beasts',
      tokenId: '567',
    },
    seller: 'HABCDEF...67890',
    startPrice: 500,
    floorPrice: 100,
    startTime: new Date(now - 7200000).toISOString(), // started 2 hours ago
    endTime: new Date(now + 3600000).toISOString(), // ends in 1 hour
    duration: 10800,
    status: 'Active',
  },
  {
    id: 'DA-003',
    nft: {
      id: 'NFT-003',
      name: 'Cyber Punk #890',
      description: 'Neon cyber punk character from the future',
      image: '/nft/cyber-punk.svg',
      collection: 'Neon City',
      tokenId: '890',
    },
    seller: 'IABCDEF...54321',
    startPrice: 750,
    floorPrice: 150,
    startTime: new Date(now - 86400000).toISOString(), // started yesterday
    endTime: new Date(now - 3600000).toISOString(), // ended 1 hour ago
    duration: 82800,
    status: 'Completed',
    winner: 'JABCDEF...98765',
    finalPrice: 225,
  },
];

