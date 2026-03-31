# Visual UI States Summary

## Card Component Examples

### Standard Card
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📊 Credit Summary                                          │
│                                                             │
│  Total Limit: $150,000.00                                   │
│  Utilized: $37,500.00                                       │
│  Available: $112,500.00                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Card with Hover Effect
```
┌─────────────────────────────────────────────────────────────┐
│  (border glows blue on hover, slight upward movement)       │
│                                                             │
│  🛡️ Risk Score                                              │
│                                                             │
│  Current Score: 78/100                                      │
│  Trend: Improving ▲                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Large Card (Draw Credit Page)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  💰 Draw Credit                                                 │
│                                                                 │
│  Select a credit line to draw from:                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  💳 Credit Line A                                        │ │
│  │  Limit: $100,000.00  Available: $75,000.00              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  💳 Credit Line B                                        │ │
│  │  Limit: $50,000.00   Available: $25,000.00               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## All Component States Visualized

### 1. Header - Disconnected State
```
┌─────────────────────────────────────────────────────────────────┐
│  Creditra    Dashboard    Credit Lines    [Connect Wallet]      │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Header - Connected State
```
┌─────────────────────────────────────────────────────────────────┐
│  Creditra    Dashboard    Credit Lines    [● GXXX...XXXX ▼]     │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Wallet: freighter │
                                            │ Network: PUBLIC   │
                                            │ ┌─────────────┐ │
                                            │ │ Disconnect  │ │
                                            │ └─────────────┘ │
                                            └───────────────┘
```

---

## Wallet Connection Modal States

### State 1: Initial / Selection
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  Choose a wallet to connect to Creditra. Your wallet will    ║
║  be used to access credit lines on Stellar.                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  🚀  Freighter                                          │ ║
║  │      Browser extension wallet for Stellar              │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⭐  Albedo                                             │ ║
║  │      Web-based Stellar wallet                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  🔒 We never store your private keys. Your wallet remains    ║
║     secure.                                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 2: Connecting (Loading)
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  Choose a wallet to connect to Creditra. Your wallet will    ║
║  be used to access credit lines on Stellar.                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  🚀  Freighter                                    ⟳     │ ║ ← Loading
║  │      Browser extension wallet for Stellar              │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⭐  Albedo                                             │ ║
║  │      Web-based Stellar wallet                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  🔒 We never store your private keys. Your wallet remains    ║
║     secure.                                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 3: Error - Wallet Not Found
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  Choose a wallet to connect to Creditra. Your wallet will    ║
║  be used to access credit lines on Stellar.                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  🚀  Freighter                                          │ ║
║  │      Browser extension wallet for Stellar              │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⭐  Albedo                                             │ ║
║  │      Web-based Stellar wallet                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⚠  Connection Failed                                   │ ║ ← Error
║  │     Freighter wallet not found. Please install the      │ ║
║  │     extension.                                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  🔒 We never store your private keys. Your wallet remains    ║
║     secure.                                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 4: Error - Connection Failed
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  Choose a wallet to connect to Creditra. Your wallet will    ║
║  be used to access credit lines on Stellar.                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  🚀  Freighter                                          │ ║
║  │      Browser extension wallet for Stellar              │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⭐  Albedo                                             │ ║
║  │      Web-based Stellar wallet                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⚠  Connection Failed                                   │ ║
║  │     Failed to connect wallet. Please try again.        │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  🔒 We never store your private keys. Your wallet remains    ║
║     secure.                                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 5: Error - Wrong Network
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  Choose a wallet to connect to Creditra. Your wallet will    ║
║  be used to access credit lines on Stellar.                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  🚀  Freighter                                          │ ║
║  │      Browser extension wallet for Stellar              │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⭐  Albedo                                             │ ║
║  │      Web-based Stellar wallet                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  ⚠  Connection Failed                                   │ ║
║  │     Please switch to Stellar network in your wallet.   │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  🔒 We never store your private keys. Your wallet remains    ║
║     secure.                                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 6: Success
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Connect Wallet                                          ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║                                                               ║
║                          ┌───┐                                ║
║                          │ ✓ │                                ║
║                          └───┘                                ║
║                                                               ║
║                    Wallet Connected!                          ║
║                                                               ║
║              You're all set to start using Creditra           ║
║                                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Onboarding Flow States

### Step 1: Welcome
```
╔═══════════════════════════════════════════════════════════════╗
║                                                          Skip  ║
║                                                               ║
║                                                               ║
║                            👋                                 ║
║                                                               ║
║                    Welcome to Creditra                        ║
║                                                               ║
║          Your adaptive credit protocol on Stellar             ║
║                      blockchain                               ║
║                                                               ║
║                                                               ║
║                        ● ○ ○                                  ║
║                                                               ║
║                      ┌────────┐                               ║
║                      │  Next  │                               ║
║                      └────────┘                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 2: Credit Evaluation
```
╔═══════════════════════════════════════════════════════════════╗
║                                                          Skip  ║
║                                                               ║
║                                                               ║
║                            📊                                 ║
║                                                               ║
║                    Credit Evaluation                          ║
║                                                               ║
║        We analyze your on-chain activity to determine         ║
║              your credit limit and terms                      ║
║                                                               ║
║                                                               ║
║                        ● ● ○                                  ║
║                                                               ║
║                      ┌────────┐                               ║
║                      │  Next  │                               ║
║                      └────────┘                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 3: Flexible Credit Lines
```
╔═══════════════════════════════════════════════════════════════╗
║                                                          Skip  ║
║                                                               ║
║                                                               ║
║                            💳                                 ║
║                                                               ║
║                  Flexible Credit Lines                        ║
║                                                               ║
║        Draw and repay credit as needed with dynamic           ║
║         interest rates based on your risk profile             ║
║                                                               ║
║                                                               ║
║                        ● ● ●                                  ║
║                                                               ║
║                   ┌──────────────┐                            ║
║                   │ Get Started  │                            ║
║                   └──────────────┘                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Color Reference

### Visual Color Swatches

```
Background Colors:
█████ #0d1117 (--bg)
█████ #161b22 (--surface)

Border & Text:
█████ #30363d (--border)
█████ #e6edf3 (--text)
█████ #8b949e (--muted)

Status Colors:
█████ #58a6ff (--accent / blue)
█████ #3fb950 (--success / green)
█████ #d29922 (--warning / orange)
█████ #f85149 (--error / red)
```

---

## Interactive State Transitions

### Button Hover Effect
```
Normal:     [  Connect Wallet  ]
            ↓ (hover)
Hover:      [  Connect Wallet  ] ↑ (lifts 1-2px)
            ↓ (click)
Active:     [  Connect Wallet  ] (pressed)
```

### Wallet Card Hover
```
Normal:     ┌─────────────────────┐
            │ 🚀 Freighter        │
            │ Browser extension   │
            └─────────────────────┘
            ↓ (hover)
Hover:      ┌─────────────────────┐ ↑
            │ 🚀 Freighter        │ (blue border + lift)
            │ Browser extension   │
            └─────────────────────┘
```

### Status Dot Animation
```
Frame 1:  ● (opacity: 1.0)
Frame 2:  ● (opacity: 0.5)
Frame 3:  ● (opacity: 1.0)
(repeats)
```

### Loading Spinner
```
Frame 1:  ◜
Frame 2:  ◝
Frame 3:  ◞
Frame 4:  ◟
(rotates continuously)
```

---

## Responsive Layouts

### Mobile (< 768px)
```
┌─────────────────────────────┐
│ Creditra              ☰     │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   Modal (90% width)   │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Desktop (> 1024px)
```
┌───────────────────────────────────────────────────────────┐
│ Creditra    Dashboard    Credit Lines    [Connect Wallet] │
├───────────────────────────────────────────────────────────┤
│                                                           │
│              ┌─────────────────────┐                      │
│              │                     │                      │
│              │  Modal (480px max)  │                      │
│              │                     │                      │
│              └─────────────────────┘                      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Accessibility Indicators

### Focus States
```
Normal:   [  Button  ]
          ↓ (tab focus)
Focused:  [  Button  ]  ← Blue outline (2px)
```

### Screen Reader Announcements
- Modal opens: "Dialog opened: Connect Wallet"
- Loading: "Connecting to wallet, please wait"
- Success: "Wallet connected successfully"
- Error: "Error: [error message]"

---

## Animation Timings

```
Fast:    0.2s (fade in, slide down)
Medium:  0.3s (slide up, transitions)
Slow:    0.4s (scale in)
Smooth:  0.6s (bounce in)
Continuous: 0.8s (spin), 2s (pulse)
```

---

## Z-Index Layers

```
Layer 5: Onboarding (1001)
Layer 4: Modal (1000)
Layer 3: Dropdown (100)
Layer 2: Header (10)
Layer 1: Content (1)
Layer 0: Background (0)
```

---

## Repayment Modal States

### State 1: Input & Preview
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Make a Repayment                                        ✕   ║
║  Primary Business Line · CL-2024-001                          ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  CURRENT DEBT                                                 ║
║  Total Due                                    $187,500.00     ║
║  Includes $1,328.00 accrued interest                          ║
║                                                               ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  AMOUNT TO REPAY                                              ║
║  ┌──────┬──────┬───────┬───────┐                              ║
║  │  25% │  50% │  75%  │  MAX  │                              ║
║  └──────┴──────┴───────┴───────┘                              ║
║                                                               ║
║  $  [ 50,000.00                     ]                         ║
║                                                               ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  PREVIEW                                                      ║
║  Remaining Debt                               $137,500.00     ║
║  New Utilization (27%)                                        ║
║  [███████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒...                ]         ║
║                                                               ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║                  [  Review Repayment  ]                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 2: Error (Input > Debt)
```
╔═══════════════════════════════════════════════════════════════╗
║  AMOUNT TO REPAY                                              ║
║  $  [ 200,000.00                    ]   ← Red Border          ║
║  ⚠ Amount exceeds total outstanding debt                      ║
║                                                               ║
║                  [ Review Repayment ]   ← Disabled            ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 3: Review & Confirm
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Review Repayment                                        ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║  You are about to repay:                                      ║
║  $50,000.00                                                   ║
║                                                               ║
║  Remaining Debt After: $137,500.00                            ║
║                                                               ║
║  Wallet Balance Check:                                        ║
║  ✓ Sufficient Balance (150,000 USDC)                          ║
║                                                               ║
║  [  Back  ]                        [ Confirm Repayment ]      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 4: Pending / Loading
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Processing Repayment                                         ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║                          ⟳                                    ║
║                 Confirming on Network...                      ║
║                                                               ║
║        Please check your wallet if confirmation is            ║
║        required.                                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### State 5: Success
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Repayment Successful                                    ✕   ║
║  ─────────────────────────────────────────────────────────   ║
║                                                               ║
║                          ┌───┐                                ║
║                          │ ✓ │                                ║
║                          └───┘                                ║
║                                                               ║
║                  You repaid $50,000.00!                       ║
║                                                               ║
║            Remaining Debt: $137,500.00                        ║
║          Credit Line utilization reduced to 27%               ║
║                                                               ║
║                  [   Back to Dashboard   ]                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```
```
