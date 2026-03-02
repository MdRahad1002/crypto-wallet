# 🎬 Animation Preview Guide

This guide shows you exactly what animations to expect and when they trigger.

## 🌊 Page Load Animations

### Login/Register Page
```
┌─────────────────────────────────────┐
│                                     │
│           ⚡ (pulsing)              │  ← Animated logo (0s)
│                                     │
│        Welcome Back                 │  ← Title fades in (0.1s)
│   Sign in to access your wallet     │  ← Subtitle fades in (0.2s)
│                                     │
│   📧 Email Address                  │  ← Form slides up (0.3s)
│   [your@email.com      ]            │
│                                     │
│   🔒 Password                       │
│   [••••••••            ]            │
│                                     │
│   [   Sign In →   ]                 │
│                                     │
│   Don't have an account?            │  ← Footer fades in (0.4s)
│   Create Account →                  │
│                                     │
└─────────────────────────────────────┘
```

**Animation Timeline:**
- **0.0s**: Logo appears with gradient + pulse animation
- **0.1s**: Title fades in from below
- **0.2s**: Subtitle fades in from below
- **0.3s**: Form fields slide up
- **0.4s**: Footer link fades in

**Hover Effects:**
- Logo: Continuous pulse (opacity 0.7-1.0)
- Inputs: Focus glow + translate up 2px
- Button: Scale + shadow increase
- Link: Color change to blue + underline grows

**Error State:**
- Error message shakes left-right (5px amplitude)
- Red background with pulse

---

## 📊 Dashboard Load Sequence

```
┌────────────────────────────────────────────────────┐
│  ⚡ CryptoWallet              📊 Dashboard   👤 John  🚪 Sign Out │  ← Navbar slides down (0s)
├────────────────────────────────────────────────────┤
│                                                    │
│  Portfolio                                         │  ← Title (0.1s)
│  Manage your crypto portfolio with ease            │  ← Subtitle (0.2s)
│                                    [+ Create] [🔄 Recover] [⚡ Send] │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  ← Stats cards
│  │ 💰       │  │ 👛       │  │ 📊       │        │     (0.4s, 0.5s, 0.6s)
│  │ $1,234   │  │ 3 Wallets│  │ 12 Trans │        │
│  └──────────┘  └──────────┘  └──────────┘        │
│                                                    │
│  📈 Live Market Prices                    [LIVE]  │  ← Section (0.7s)
│  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │ ₿ BTC  │  │ ⟠ ETH  │  │ ◆ BNB  │              │  ← Price cards
│  │ $45,000│  │ $3,200 │  │ $320   │              │     (0.7s, 0.8s, 0.9s)
│  └────────┘  └────────┘  └────────┘              │
│                                                    │
│  Your Wallets                                      │  ← Section
│  ┌───────────────┐  ┌───────────────┐            │
│  │ Ethereum      │  │ Bitcoin       │            │  ← Wallet cards
│  │ 2.5 ETH       │  │ 0.05 BTC      │            │     (0.8s, 0.9s)
│  └───────────────┘  └───────────────┘            │
│                                                    │
│  Recent Transactions                    [12 Total]│
│  ────────────────────────────────────────────     │
│  🟢 Received  0.5 ETH      2 hours ago   +$1,600 │  ← Transaction 1 (0.9s)
│  🔴 Sent      0.1 BTC      5 hours ago   -$4,500 │  ← Transaction 2 (1.0s)
│                                                    │
│                                          [📷]     │  ← FAB button (1.1s)
└────────────────────────────────────────────────────┘
```

**Animation Sequence:**
1. **0.0s** - Navbar slides from top (-100% → 0)
2. **0.1s** - "Portfolio" title fades up
3. **0.2s** - Subtitle fades up
4. **0.3s** - Action buttons appear
5. **0.4s** - First stat card fades up
6. **0.5s** - Second stat card fades up
7. **0.6s** - Third stat card fades up
8. **0.7s** - Live prices section + first price
9. **0.8s** - Second price + first wallet
10. **0.9s** - Third price + second wallet + first transaction
11. **1.0s** - Second transaction
12. **1.1s** - FAB button fades in

---

## 🎭 Hover Animations

### Card Hover Effect
```
Before Hover:          On Hover:
┌──────────┐          ┌──────────┐
│          │          │    ↑8px  │ ← Moves up
│  Card    │   →      │ [GLOWING]│ ← Glow effect
│          │          │ Scale:1.02│ ← Slightly larger
└──────────┘          └──────────┘
                           ↓
                      Shadow increases
```

**Transform:**
- `translateY(-8px)` - Moves up
- `scale(1.02)` - Grows 2%
- Shadow blur increases
- Border color becomes blue

### Button Hover Effect
```
Before:                On Hover:              On Click:
[  Button  ]    →     [ ✨Button✨ ]    →    [ Button ]
                      Ripple effect          Scale: 0.96
                      Shadow grows           Pressed down
```

**States:**
- **Rest**: Normal appearance
- **Hover**: Scale + shadow + ripple
- **Active**: Scale down to 0.96
- **Focus**: Blue glow ring

### Transaction Item Hover
```
Before:                              On Hover:
🟢 Received  0.5 ETH    +$1,600  →  🟢 Received  0.5 ETH    +$1,600 →
  Normal appearance                  Slides right 5px
                                     Background: blue tint
                                     Border: blue glow
```

---

## 💫 Interactive Animations

### Form Input Focus
```
Idle:                 Focus:                  Typing:
[              ]  →   [┃             ]   →   [text┃         ]
Gray border           Blue glow              Placeholder fades
                      Moves up 2px           Blue background tint
```

**Animation:**
- Border: gray → blue (0.3s)
- Shadow: none → 4px blue glow
- Transform: translateY(-2px)
- Background: transparent → blue tint

### Modal Open/Close
```
Opening:                      Closing:
Background fades in    →      Background fades out
      ↓                              ↓
Modal slides up        →      Modal scales down
      ↓                              ↓
Content appears        →      Content disappears
```

**Open Animation:**
1. Background fade (0 → 0.9 opacity, 0.3s)
2. Modal slide up (50px → 0, 0.4s)
3. Modal scale (0.95 → 1, 0.4s)

**Close Animation:**
1. Modal scale down (1 → 0.95, 0.2s)
2. Background fade out (0.9 → 0, 0.2s)

### Close Button Animation
```
Rest:        Hover:        Click:
  ✕    →      ✕     →      ✕
            Rotate 90°    Scale 0.95
            Red bg        Quick pulse
```

---

## 🎨 Special Effects

### Glassmorphism
```
┌─────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← Blurred background
│ ░░░ Card Content ░░│ ← Semi-transparent
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← Frosted glass effect
└─────────────────────┘
```

**Properties:**
- `background: rgba(28, 28, 30, 0.85)`
- `backdrop-filter: blur(30px)`
- `border: 1px solid rgba(255,255,255,0.1)`

### Gradient Animation
```
Start:           Middle:         End:
████████   →    ████████   →   ████████
Blue            Purple         Blue
                Shifts continuously
```

**Keyframe:**
```css
0%   → position: 0%
50%  → position: 100%
100% → position: 0%
```

### Pulse Effect (Live Badge)
```
Normal:      Pulse:       Normal:
[LIVE]   →   [LIVE]   →   [LIVE]
100%         120%         100%
             (opacity)
```

---

## 🎪 Loading States

### Spinner Animation
```
     ╱─╲         ╱ ─╲        ╱─ ╲
    │   │   →   │   │  →   │   │
     ╲─╱         ╲─ ╱        ╲ ─╱
   Rotates continuously (0.8s)
```

**Structure:**
- Outer ring: Blue, rotates clockwise
- Inner ring: Green, rotates counter-clockwise

### Skeleton Loader
```
████████░░░░░░░░    (Pulsing)
░░░░░░░░████████    
████████░░░░░░░░    (0.4 ↔ 0.8 opacity)
```

---

## 🌊 Stagger Effects

### Card List Stagger
```
Card 1: delay 0.1s  →  ┌──────┐
Card 2: delay 0.2s  →  │      │
Card 3: delay 0.3s  →  │      │
Card 4: delay 0.4s  →  └──────┘

Each appears 0.1s after previous
```

### Transaction List Stagger
```
Transaction 1: 0.05s  →  ──────────
Transaction 2: 0.10s  →  ──────────
Transaction 3: 0.15s  →  ──────────
Transaction 4: 0.20s  →  ──────────

Each slides in from left
```

---

## 🎯 Timing Reference

### Animation Durations
- **Quick**: 0.2s (button press, click)
- **Normal**: 0.3-0.4s (hover, transitions)
- **Smooth**: 0.6s (entrance animations)
- **Slow**: 1.0s+ (continuous animations)

### Easing Functions
- **Entrance**: `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (bounce)
- **Exit**: `ease-out`
- **Hover**: `ease` or `cubic-bezier`
- **Continuous**: `ease-in-out` (pulse, bounce)

---

## 📱 Mobile-Specific Animations

On mobile devices:
- Reduced animation durations (80% of desktop)
- Simpler hover states (tap highlights)
- Touch-optimized transitions
- Respect `prefers-reduced-motion`

---

## 🎬 Performance Tips

To maintain 60fps:
1. Use `transform` and `opacity` only
2. Avoid animating `width`, `height`, `margin`
3. Use `will-change` sparingly
4. Keep animation durations < 0.6s for most
5. Test on slower devices

---

**All animations are designed to be:**
- ✅ Smooth (60fps)
- ✅ Natural (realistic easing)
- ✅ Purposeful (guide attention)
- ✅ Performant (GPU accelerated)
- ✅ Accessible (respect user preferences)

**Experience the magic! 🎪✨**
