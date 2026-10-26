import { ComponentType, lazy, LazyExoticComponent } from 'react';

export interface PaletteNav {
  label: string;
  icon: string;
  description: string;
}

export interface RouteNav {
  header?: boolean;
  headerLabel?: string;
  palette?: PaletteNav;
}

export interface RouteManifestEntry {
  path: string;
  pageName: string;
  description: string;
  load: () => Promise<{ default: ComponentType<any> }>;
  Component: LazyExoticComponent<ComponentType<any>>;
  nav?: RouteNav;
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  {
    path: '/',
    pageName: 'Dashboard',
    description: 'Review your Creditra portfolio, credit utilization, risk score, and repayment activity.',
    load: () => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard })),
    Component: lazy(() => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard }))),
    nav: {
      header: true,
      headerLabel: 'Dashboard',
      palette: {
        label: 'Dashboard',
        icon: '🏠',
        description: 'Go to Dashboard',
      },
    },
  },
  {
    path: '/transactions',
    pageName: 'Transaction History',
    description: 'Search, filter, and export your Creditra deposits, draws, repayments, and fees.',
    load: () => import('../pages/TransactionHistory').then((m) => ({ default: m.TransactionHistory })),
    Component: lazy(() => import('../pages/TransactionHistory').then((m) => ({ default: m.TransactionHistory }))),
    nav: {
      header: true,
      headerLabel: 'Transactions',
      palette: {
        label: 'Transactions',
        icon: '📋',
        description: 'View transaction history',
      },
    },
  },
  {
    path: '/credit-lines',
    pageName: 'Credit Lines',
    description: 'Manage available Creditra credit lines, balances, limits, and repayment status.',
    load: () => import('../pages/CreditLines'),
    Component: lazy(() => import('../pages/CreditLines')),
    nav: {
      header: true,
      headerLabel: 'Credit Lines',
      palette: {
        label: 'Credit Lines',
        icon: '💳',
        description: 'Manage your credit lines',
      },
    },
  },
  {
    path: '/help',
    pageName: 'Help Center',
    description: 'Find Creditra support articles, wallet guidance, FAQs, and product walkthroughs.',
    load: () => import('../pages/HelpCenter'),
    Component: lazy(() => import('../pages/HelpCenter')),
    nav: {
      palette: {
        label: 'Help Center',
        icon: '❓',
        description: 'Browse help articles',
      },
    },
  },
  {
    path: '/draw-credit',
    pageName: 'Draw Credit',
    description: 'Select an active credit line and draw available funds from your Creditra account.',
    load: () => import('../pages/DrawCreditPage'),
    Component: lazy(() => import('../pages/DrawCreditPage')),
    nav: {
      palette: {
        label: 'Draw',
        icon: '⬇️',
        description: 'Draw from a credit line',
      },
    },
  },
  {
    path: '/draw-credit/success',
    pageName: 'Draw Credit Success',
    description: 'Review confirmation details for your completed Creditra credit draw.',
    load: () => import('../pages/DrawCreditPage'),
    Component: lazy(() => import('../pages/DrawCreditPage')),
  },
  {
    path: '/open-credit',
    pageName: 'Request Evaluation',
    description: 'Request a Creditra credit evaluation to open a new borrower credit line.',
    load: () => import('../pages/RequestEvaluation').then((m) => ({ default: m.RequestEvaluation })),
    Component: lazy(() => import('../pages/RequestEvaluation').then((m) => ({ default: m.RequestEvaluation }))),
    nav: {
      header: true,
      headerLabel: 'Open Credit Line',
      palette: {
        label: 'Request Evaluation',
        icon: '📝',
        description: 'Apply for a new credit line',
      },
    },
  },
  {
    path: '/dutch-auctions',
    pageName: 'Dutch Auctions',
    description: 'Monitor Creditra Dutch auction opportunities, bids, clearing prices, and market activity.',
    load: () => import('../pages/DutchAuctions').then((m) => ({ default: m.DutchAuctions })),
    Component: lazy(() => import('../pages/DutchAuctions').then((m) => ({ default: m.DutchAuctions }))),
    nav: {
      header: true,
      headerLabel: 'Dutch Auctions',
      palette: {
        label: 'Dutch Auctions',
        icon: '🔨',
        description: 'View active auctions',
      },
    },
  },
  {
    path: '/dutch-auctions/:auctionId',
    pageName: 'Dutch Auction Details',
    description: 'View a single Creditra Dutch auction, its price schedule, and purchase options.',
    load: () => import('../pages/DutchAuctionDetail').then((m) => ({ default: m.DutchAuctionDetail })),
    Component: lazy(() => import('../pages/DutchAuctionDetail').then((m) => ({ default: m.DutchAuctionDetail }))),
  },
  {
    path: '/linked-accounts',
    pageName: 'Linked Accounts',
    description: 'Manage linked external accounts and credentials for your Creditra profile.',
    load: () => import('../pages/LinkedAccounts').then((m) => ({ default: m.LinkedAccounts })),
    Component: lazy(() => import('../pages/LinkedAccounts').then((m) => ({ default: m.LinkedAccounts }))),
    nav: {
      palette: {
        label: 'Linked Accounts',
        icon: '🔗',
        description: 'Manage linked external accounts',
      },
    },
  },
  {
    path: '/notification-preferences',
    pageName: 'Notification Preferences',
    description: 'Manage communication channels, alert frequency, and subscription preferences.',
    load: () => import('../pages/NotificationPreferences').then((m) => ({ default: m.NotificationPreferences })),
    Component: lazy(() => import('../pages/NotificationPreferences').then((m) => ({ default: m.NotificationPreferences }))),
    nav: {
      palette: {
        label: 'Notification Settings',
        icon: '🔔',
        description: 'Manage notification preferences',
      },
    },
  },
  {
    path: '/repay',
    pageName: 'Repay',
    description: 'Make repayments towards active Creditra credit line balances.',
    load: () => import('../pages/RepayPage'),
    Component: lazy(() => import('../pages/RepayPage')),
    nav: {
      palette: {
        label: 'Repay',
        icon: '💰',
        description: 'Make a repayment',
      },
    },
  },
  {
    path: '/repay/success',
    pageName: 'Repay Success',
    description: 'Confirmation details for your successful credit repayment transaction.',
    load: () => import('../pages/RepaySuccess'),
    Component: lazy(() => import('../pages/RepaySuccess')),
  },
  {
    path: '/settings',
    pageName: 'Settings',
    description: 'Manage application preferences, network configuration, and account settings.',
    load: () => import('../pages/Settings').then((m) => ({ default: m.Settings })),
    Component: lazy(() => import('../pages/Settings').then((m) => ({ default: m.Settings }))),
    nav: {
      palette: {
        label: 'Settings',
        icon: '⚙️',
        description: 'Manage account settings',
      },
    },
  },
  {
    path: '/settings/notifications',
    pageName: 'Notification Settings',
    description: 'Configure system alerts, security notices, and transaction notifications.',
    load: () => import('../pages/settings/Notifications'),
    Component: lazy(() => import('../pages/settings/Notifications')),
    nav: {
      palette: {
        label: 'Notification Alerts',
        icon: '🔔',
        description: 'Configure notification alerts and alerts',
      },
    },
  },
  {
    path: '/profile',
    pageName: 'Profile',
    description: 'View and update your Creditra borrower profile, verification status, and tier.',
    load: () => import('../pages/Profile'),
    Component: lazy(() => import('../pages/Profile')),
    nav: {
      palette: {
        label: 'Profile',
        icon: '👤',
        description: 'View your user profile',
      },
    },
  },
  {
    path: '/docs',
    pageName: 'Documentation',
    description: 'Access Creditra protocol documentation, guides, and developer resources.',
    load: () => import('../pages/Docs'),
    Component: lazy(() => import('../pages/Docs')),
    nav: {
      header: true,
      headerLabel: 'Docs',
      palette: {
        label: 'Docs',
        icon: '📚',
        description: 'View documentation',
      },
    },
  },
];
