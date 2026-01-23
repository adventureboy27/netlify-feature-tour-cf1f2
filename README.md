# 🎮 Junkyard Bomb Defense War

A 2-player turn-based artillery game built with Phaser.js 3 and Vite. Destroy your opponent's bomb while defending your own with strategic junk placement!

## 🎯 Game Overview

**Objective:** Destroy your opponent's bomb core (150 HP) before they destroy yours!

### Core Gameplay

- **Setup Phase (30s):** Arrange 10 random junk pieces to protect your bomb
- **Combat Phase:** Take turns firing 3 shots each at your opponent
- **Rearrange Phase (10s):** Reposition your defenses between rounds
- **Victory:** First player to destroy the opponent's bomb core wins!

### Players

- **Player 1 (Red Zone):** Left side of the battlefield
- **Player 2 (Blue Zone):** Right side of the battlefield

## 🔧 Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000` (or the URL shown in terminal)

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Preview production build:**
   ```bash
   npm run preview
   ```

## 🎮 How to Play

### Setup Phase

1. When the game starts, you have 30 seconds to arrange your junk pieces
2. **Drag and drop** junk pieces anywhere in your zone
3. Place them strategically to protect your bomb's core and quadrants
4. Once time runs out, combat begins!

### Combat Phase

1. **Select a weapon** from the weapon panel (8 weapons available)
2. **Adjust angle** (10-85°) using the slider
3. **Set power** (20-100%) using the slider
4. Click **FIRE** to launch your shot
5. Watch the trajectory affected by **wind** (-15 to +15 mph)
6. Each player gets **3 shots per turn**

### Weapons Arsenal

| Weapon | Damage | Ammo | Special |
|--------|--------|------|---------|
| 🎯 Slingshot | 10 | ∞ | Basic weapon |
| 🔫 Pistol | 20 | 15 | Fast, low arc |
| 🎯 Rifle | 30 | 10 | High speed, accurate |
| 💥 Shotgun | 45 | 6 | Fires 3 projectiles |
| 💣 Grenade | 50 | 3 | Explodes on impact (60px radius) |
| 🔥 Molotov | 25 | 5 | Sets flammable objects on fire |
| 🚀 RPG | 80 | 2 | Massive explosion (80px radius) |
| 🔥 Flamethrower | 35 | 8 | Spreads fire to nearby objects |

### Junk Types

12 types of junk with unique properties:

**Small:**
- ⛽ **Gas Can** (25 HP) - Flammable & Explosive
- 🔋 **Car Battery** (30 HP) - Explosive
- 🎨 **Paint Can** (20 HP) - Flammable

**Medium:**
- 🛞 **Tire** (45 HP) - Flammable
- 🛢️ **Barrel** (50 HP) - Solid
- 📦 **Crate** (35 HP) - Flammable
- 🧯 **Propane Tank** (40 HP) - Flammable & Explosive
- 🪵 **Wood Planks** (30 HP) - Flammable

**Large:**
- 🧊 **Fridge** (80 HP) - Solid & Heavy
- 🔩 **Metal Sheet** (70 HP) - Solid
- ⚙️ **Engine Block** (90 HP) - Solid & Heavy
- 🔒 **Safe** (100 HP) - Solid & Heavy

### Properties Explained

- **Flammable:** Catches fire from Molotov/Flamethrower, can spread to nearby flammable items
- **Explosive:** Explodes when destroyed, damaging nearby items in 50px radius
- **Solid:** Higher HP, better protection
- **Heavy:** More durable (visual indication)

### Bomb Structure

Each bomb has 5 parts:

- **4 Quadrants** (100 HP each): Top-left, top-right, bottom-left, bottom-right
- **Core** (150 HP): Center - when this reaches 0, you lose!

**Damage Rules:**
- Direct core hit (within 12px) = Full damage to core
- Quadrant hit (12-30px from center) = Damage quadrant + 30% bleeds to core
- Destroyed quadrants expose the core more

## 🎲 Game Mechanics

### Physics

- **Gravity:** Affects all projectiles with arc-based trajectory
- **Wind:** Random wind (-15 to +15 mph) each round affects horizontal velocity
- **Angle & Power:** Combine to determine projectile path

### Chain Reactions

- **Explosions:** Explosive junk detonates → damages nearby items in radius
- **Fire Spread:** Burning flammable items spread fire to adjacent flammable objects
- Creates dramatic combos and strategic depth!

### Rearrange Phase

- After both players complete their turns, 10-second rearrange phase begins
- Quickly reposition your junk to adapt to opponent's strategy
- Exposed areas should be reinforced!

## 🏆 Completion Notification

When the game ends, you'll receive:

1. **Visual Notification:** Green banner with victory message
2. **Browser Notification:** Desktop notification announcing the winner (requires permission)
3. **Victory Screen:** Trophy, winner announcement, and celebration effects
4. **Play Again Button:** Jump back into action!

## 🎨 Features

- ✅ Full 2-player hot-seat multiplayer
- ✅ 8 unique weapons with different mechanics
- ✅ 12 types of junk with special properties
- ✅ Physics-based projectile system
- ✅ Wind mechanics affecting trajectory
- ✅ Fire spreading system
- ✅ Explosion chain reactions
- ✅ Particle effects for explosions, fire, and impacts
- ✅ Drag-and-drop junk placement
- ✅ Timed setup and rearrange phases
- ✅ Bomb quadrant damage system
- ✅ Victory conditions and game over screen
- ✅ Completion notifications (visual + browser)

## 🗂️ Project Structure

```
junkyard-bomb-defense/
├── package.json
├── vite.config.js
├── index.html
├── README.md
└── src/
    ├── main.js                    # Game entry point
    ├── config/
    │   ├── gameConfig.js          # Phaser configuration
    │   ├── junkLibrary.js         # 12 junk types
    │   └── weaponsConfig.js       # 8 weapons
    ├── scenes/
    │   ├── BootScene.js           # Preload assets
    │   ├── MenuScene.js           # Start screen
    │   ├── SetupScene.js          # Junk arrangement phase
    │   ├── CombatScene.js         # Main gameplay
    │   └── GameOverScene.js       # Victory screen with notifications
    ├── objects/
    │   ├── Bomb.js                # Bomb with quadrants + core
    │   ├── Junk.js                # Junk piece
    │   ├── Projectile.js          # Fired projectiles
    │   └── Player.js              # Player state
    ├── systems/
    │   ├── PhysicsManager.js      # Wind & gravity
    │   ├── ExplosionSystem.js     # Chain reactions
    │   └── FireSystem.js          # Fire spreading
    └── utils/
        ├── CollisionDetector.js   # Collision detection
        └── ParticleEffects.js     # Visual effects
```

## 🎯 Strategy Tips

1. **Protect the Core:** Place your strongest junk (Safe, Engine Block) near the center
2. **Explosive Placement:** Don't cluster explosive items - chain reactions hurt you!
3. **Flammable Spacing:** Keep flammable items spread out to prevent fire spread
4. **Wind Awareness:** Adjust your angle based on wind direction
5. **Weapon Conservation:** Save RPGs and Grenades for critical moments
6. **Rearrange Smart:** After taking damage, reorganize to cover exposed quadrants

## 🐛 Troubleshooting

**Game won't start:**
- Make sure you've run `npm install`
- Check that port 3000 is available
- Try `npm run dev` again

**Browser notifications not working:**
- Allow notification permissions when prompted
- Check browser settings for notification permissions
- Note: Some browsers block notifications on localhost

**Performance issues:**
- Try closing other browser tabs
- Disable browser extensions
- Use a modern browser (Chrome, Firefox, Edge)

## 📝 License

This project is open source and available for educational purposes.

## 🎮 Enjoy the Game!

Have fun blowing up your opponent's bomb while protecting your own junkyard fortress!
