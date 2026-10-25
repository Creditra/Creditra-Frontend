import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { LiveRegion } from './LiveRegion';
import { readJson, writeJson } from '../utils/storage';

const STORAGE_KEY_MUTED = 'creditra:auction-alerts-muted';

export interface AuctionAnnouncementItem {
  auctionId: string;
  message: string;
}

interface AuctionAnnouncerContextValue {
  enqueueMilestone: (item: AuctionAnnouncementItem) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const AuctionAnnouncerContext = createContext<AuctionAnnouncerContextValue | null>(null);

export function useAuctionAnnouncer(): AuctionAnnouncerContextValue {
  const ctx = useContext(AuctionAnnouncerContext);
  if (!ctx) {
    return {
      enqueueMilestone: () => {},
      isMuted: false,
      toggleMute: () => {},
    };
  }
  return ctx;
}

interface AuctionAnnouncerProviderProps {
  children: React.ReactNode;
}

export const AuctionAnnouncerProvider: React.FC<AuctionAnnouncerProviderProps> = ({ children }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => readJson<boolean>(STORAGE_KEY_MUTED, false));
  const [currentAnnouncement, setCurrentAnnouncement] = useState('');
  
  // Queue of announcement items
  const queueRef = useRef<AuctionAnnouncementItem[]>([]);
  // Last time an announcement was spoken / displayed
  const lastAnnounceTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      // Clear queue and pending timer immediately if muted
      queueRef.current = [];
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCurrentAnnouncement('');
    }
  }, [isMuted]);

  const processQueue = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isMutedRef.current) {
      queueRef.current = [];
      return;
    }

    if (queueRef.current.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - lastAnnounceTimeRef.current;
    const minDelay = 3000;

    if (timeSinceLast >= minDelay) {
      // Dequeue next message
      const nextItem = queueRef.current.shift();
      if (nextItem) {
        lastAnnounceTimeRef.current = now;
        setCurrentAnnouncement(nextItem.message);
      }

      if (queueRef.current.length > 0) {
        timerRef.current = setTimeout(() => {
          processQueue();
        }, minDelay);
      }
    } else {
      const waitTime = minDelay - timeSinceLast;
      timerRef.current = setTimeout(() => {
        processQueue();
      }, waitTime);
    }
  }, []);

  const enqueueMilestone = useCallback((item: AuctionAnnouncementItem) => {
    if (isMutedRef.current) return;

    // Deduplication rule: messages for the same auction replace each other in the queue instead of piling up
    const existingIndex = queueRef.current.findIndex(q => q.auctionId === item.auctionId);
    if (existingIndex !== -1) {
      queueRef.current[existingIndex] = item;
    } else {
      queueRef.current.push(item);
    }

    processQueue();
  }, [processQueue]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      writeJson(STORAGE_KEY_MUTED, next);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <AuctionAnnouncerContext.Provider value={{ enqueueMilestone, isMuted, toggleMute }}>
      {children}
      <LiveRegion
        id="auction-announcer-live-region"
        message={currentAnnouncement}
        politeness="polite"
      />
    </AuctionAnnouncerContext.Provider>
  );
};
