# Visual UI States Summary

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
