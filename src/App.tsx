/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Zap, Globe } from 'lucide-react';

// --- Types ---

type RocketType = 'NORMAL' | 'FAST' | 'HEAVY' | 'SPLITTER' | 'SUB' | 'ZIGZAG' | 'STEALTH' | 'ACCEL' | 'SUPER_FAST' | 'NUCLEAR';

type Rocket = {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  type: RocketType;
  color: string;
  size: number;
  hasSplit?: boolean;
  offset?: number; // For zigzag
  opacity?: number; // For stealth
};

type Interceptor = {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  turretId: number;
  isSpecial?: boolean;
};

type Explosion = {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growing: boolean;
  opacity: number;
};

type Turret = {
  id: number;
  x: number;
  y: number;
  missiles: number;
  maxMissiles: number;
  isDestroyed: boolean;
  specialCharge: number; // 0 to 100
};

type City = {
  id: number;
  x: number;
  y: number;
  isDestroyed: boolean;
};

type BossType = 'MOTHERSHIP' | 'DESTROYER' | 'HARBINGER';

type Boss = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  active: boolean;
  targetX: number;
  speed: number;
  lastShootTime: number;
  hasSpawnedThisRound: boolean;
  type: BossType;
};

type GameState = 'START' | 'PLAYING' | 'GAME_OVER' | 'SUCCESS';

// --- Constants ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const EXPLOSION_SPEED = 1.5;
const EXPLOSION_MAX_RADIUS = 40;
const INTERCEPTOR_SPEED = 5;
const ROCKET_BASE_SPEED = 0.5;
const WIN_SCORE = 5000;

// --- Translations ---

const i18n = {
  zh: {
    title: "jack新星防御",
    start: "开始游戏",
    restart: "再玩一次",
    gameOver: "防御失败",
    success: "防御成功",
    score: "得分",
    missiles: "导弹",
    round: "回合",
    protect: "保护你的城市",
    instructions: "点击屏幕发射拦截导弹。预判敌方火箭轨迹，利用爆炸范围摧毁它们。",
    winMsg: "你成功保卫了新星！",
    loseMsg: "所有炮台已被摧毁...",
  },
  en: {
    title: "jack Nova Defense",
    start: "Start Game",
    restart: "Play Again",
    gameOver: "Defense Failed",
    success: "Defense Success",
    score: "Score",
    missiles: "Missiles",
    round: "Round",
    protect: "Protect your cities",
    instructions: "Click anywhere to fire interceptors. Predict rocket paths and use explosion AoE.",
    winMsg: "You successfully defended Nova!",
    loseMsg: "All turrets have been destroyed...",
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  
  // Game Entities Refs
  const rocketsRef = useRef<Rocket[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const turretsRef = useRef<Turret[]>([
    { id: 0, x: 100, y: 560, missiles: 20, maxMissiles: 20, isDestroyed: false },
    { id: 1, x: 400, y: 560, missiles: 40, maxMissiles: 40, isDestroyed: false },
    { id: 2, x: 700, y: 560, missiles: 20, maxMissiles: 20, isDestroyed: false },
  ]);
  const citiesRef = useRef<City[]>([
    { id: 0, x: 200, y: 570, isDestroyed: false },
    { id: 1, x: 280, y: 570, isDestroyed: false },
    { id: 2, x: 360, y: 570, isDestroyed: false },
    { id: 3, x: 440, y: 570, isDestroyed: false },
    { id: 4, x: 520, y: 570, isDestroyed: false },
    { id: 5, x: 600, y: 570, isDestroyed: false },
  ]);

  const bossRef = useRef<Boss>({
    x: CANVAS_WIDTH / 2,
    y: -100,
    hp: 0,
    maxHp: 2000,
    active: false,
    targetX: CANVAS_WIDTH / 2,
    speed: 1,
    lastShootTime: 0,
    hasSpawnedThisRound: false,
    type: 'MOTHERSHIP'
  });

  const [bossActive, setBossActive] = useState(false);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(2000);

  const t = i18n[lang];

  const initGame = useCallback(() => {
    setScore(0);
    setRound(1);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    turretsRef.current = [
      { id: 0, x: 100, y: 560, missiles: 20, maxMissiles: 20, isDestroyed: false, specialCharge: 0 },
      { id: 1, x: 400, y: 560, missiles: 40, maxMissiles: 40, isDestroyed: false, specialCharge: 0 },
      { id: 2, x: 700, y: 560, missiles: 20, maxMissiles: 20, isDestroyed: false, specialCharge: 0 },
    ];
    citiesRef.current = citiesRef.current.map(c => ({ ...c, isDestroyed: false }));
    bossRef.current = {
      x: CANVAS_WIDTH / 2,
      y: -100,
      hp: 0,
      maxHp: 2000,
      active: false,
      targetX: CANVAS_WIDTH / 2,
      speed: 1,
      lastShootTime: 0,
      hasSpawnedThisRound: false,
      type: 'MOTHERSHIP'
    };
    setBossActive(false);
    setGameState('PLAYING');
  }, []);

  const spawnRocket = useCallback(() => {
    if (bossRef.current.active) return;

    // Boss spawn logic
    const shouldSpawnBoss = (round >= 2) && !bossRef.current.hasSpawnedThisRound;
    
    if (shouldSpawnBoss && !bossRef.current.active) {
      bossRef.current.active = true;
      bossRef.current.hasSpawnedThisRound = true;
      
      // Cycle boss types
      const bossCycle: BossType[] = ['MOTHERSHIP', 'DESTROYER', 'HARBINGER'];
      bossRef.current.type = bossCycle[(round - 2) % 3];
      
      const hpMult = 1 + (Math.floor((round - 2) / 3) * 0.5);
      bossRef.current.hp = (bossRef.current.type === 'MOTHERSHIP' ? 1000 : bossRef.current.type === 'DESTROYER' ? 1500 : 2000) * hpMult;
      bossRef.current.maxHp = bossRef.current.hp;
      bossRef.current.y = -100;
      bossRef.current.speed = bossRef.current.type === 'DESTROYER' ? 1.5 : 1;
      
      setBossActive(true);
      setBossHp(bossRef.current.hp);
      setBossMaxHp(bossRef.current.maxHp);
      return;
    }

    const targets = [...citiesRef.current.filter(c => !c.isDestroyed), ...turretsRef.current.filter(t => !t.isDestroyed)];
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    
    // Determine rocket type based on round
    const rand = Math.random();
    let type: RocketType = 'NORMAL';
    let speedMult = 1;
    let color = '#ff4444';
    let size = 2;

    if (round > 2 && rand > 0.85) {
      type = 'FAST';
      speedMult = 1.8;
      color = '#ff00ff';
      size = 1.5;
    } else if (round > 4 && rand > 0.75) {
      type = 'HEAVY';
      speedMult = 0.6;
      color = '#ff8800';
      size = 4;
    } else if (round > 6 && rand > 0.65) {
      type = 'SPLITTER';
      speedMult = 0.9;
      color = '#ffff00';
      size = 2.5;
    } else if (round > 3 && rand > 0.5) {
      type = 'ZIGZAG';
      speedMult = 1.2;
      color = '#00ff00';
      size = 2;
    } else if (round > 5 && rand > 0.4) {
      type = 'STEALTH';
      speedMult = 1.0;
      color = '#8888ff';
      size = 2;
    } else if (round > 7 && rand > 0.3) {
      type = 'ACCEL';
      speedMult = 0.4;
      color = '#ffffff';
      size = 2;
    } else if (round > 8 && rand > 0.2) {
      type = 'SUPER_FAST';
      speedMult = 3.5;
      color = '#00ffff';
      size = 1.2;
    } else if (round > 10 && rand > 0.1) {
      type = 'NUCLEAR';
      speedMult = 0.25;
      color = '#7cfc00'; // Lawn Green
      size = 8;
    }

    const rocket: Rocket = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * CANVAS_WIDTH,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed: (ROCKET_BASE_SPEED + (round * 0.1)) * speedMult,
      type,
      color,
      size,
      offset: Math.random() * Math.PI * 2,
      opacity: 1
    };
    rocketsRef.current.push(rocket);
  }, [round]);

  const fireInterceptor = (targetX: number, targetY: number, forceTurretId?: number, isSpecial: boolean = false) => {
    if (gameState !== 'PLAYING') return;

    let turret;
    if (forceTurretId !== undefined) {
      turret = turretsRef.current.find(t => t.id === forceTurretId && !t.isDestroyed && (t.missiles > 0 || isSpecial));
    } else {
      const availableTurrets = turretsRef.current
        .filter(t => !t.isDestroyed && t.missiles > 0)
        .sort((a, b) => {
          const distA = Math.hypot(a.x - targetX, a.y - targetY);
          const distB = Math.hypot(b.x - targetX, b.y - targetY);
          return distA - distB;
        });
      turret = availableTurrets[0];
    }

    if (turret) {
      if (!isSpecial) turret.missiles -= 1;

      const interceptor: Interceptor = {
        id: Math.random().toString(36).substr(2, 9),
        x: turret.x,
        y: turret.y,
        startX: turret.x,
        startY: turret.y,
        targetX,
        targetY,
        speed: INTERCEPTOR_SPEED * (isSpecial ? 1.5 : 1),
        turretId: turret.id,
        isSpecial
      };
      interceptorsRef.current.push(interceptor);
    }
  };

  const triggerSpecial = (turretId: number) => {
    const turret = turretsRef.current.find(t => t.id === turretId);
    if (!turret || turret.isDestroyed || turret.specialCharge < 100) return;

    turret.specialCharge = 0;

    if (turretId === 0) {
      // Left: Cluster Salvo (3 shots)
      fireInterceptor(CANVAS_WIDTH * 0.2, 200, 0, true);
      fireInterceptor(CANVAS_WIDTH * 0.5, 150, 0, true);
      fireInterceptor(CANVAS_WIDTH * 0.8, 200, 0, true);
    } else if (turretId === 1) {
      // Center: Mega Blast (Next shot is huge)
      // We'll just fire a special one at the center top
      fireInterceptor(CANVAS_WIDTH / 2, 100, 1, true);
    } else if (turretId === 2) {
      // Right: Auto Defense (Fire at all current rockets)
      rocketsRef.current.slice(0, 5).forEach(r => {
        fireInterceptor(r.x, r.y, 2, true);
      });
    }
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastSpawnTime = 0;

    const loop = (time: number) => {
      if (time - lastSpawnTime > Math.max(2000 - (round * 200), 500)) {
        spawnRocket();
        lastSpawnTime = time;
      }

      // Update Boss
      if (bossRef.current.active) {
        const boss = bossRef.current;
        // Movement
        if (boss.y < 100) {
          boss.y += 0.5;
        } else {
          if (Math.abs(boss.x - boss.targetX) < 5) {
            boss.targetX = Math.random() * (CANVAS_WIDTH - 200) + 100;
          }
          boss.x += (boss.targetX > boss.x ? 1 : -1) * boss.speed;
        }

        // Shooting
        if (time - boss.lastShootTime > (boss.type === 'DESTROYER' ? 1000 : 1500)) {
          const targets = [...citiesRef.current.filter(c => !c.isDestroyed), ...turretsRef.current.filter(t => !t.isDestroyed)];
          if (targets.length > 0) {
            const count = boss.type === 'HARBINGER' ? 5 : 3;
            for (let i = 0; i < count; i++) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              let rocketType: RocketType = 'NORMAL';
              let color = '#ff0000';
              
              if (boss.type === 'DESTROYER') {
                rocketType = 'ZIGZAG';
                color = '#00ff00';
              } else if (boss.type === 'HARBINGER') {
                rocketType = Math.random() > 0.5 ? 'HEAVY' : 'SPLITTER';
                color = rocketType === 'HEAVY' ? '#ff8800' : '#ffff00';
              }

              rocketsRef.current.push({
                id: 'boss-' + Math.random(),
                x: boss.x + (Math.random() * 120 - 60),
                y: boss.y + 20,
                targetX: target.x,
                targetY: target.y,
                speed: boss.type === 'DESTROYER' ? 2 : 1.5,
                type: rocketType,
                color: color,
                size: rocketType === 'HEAVY' ? 4 : 3,
                offset: Math.random() * Math.PI * 2,
                opacity: 1
              });
            }
          }
          boss.lastShootTime = time;
        }
      }

      rocketsRef.current.forEach((rocket, index) => {
        const dx = rocket.targetX - rocket.x;
        const dy = rocket.targetY - rocket.y;
        const dist = Math.hypot(dx, dy);
        
        // Splitter logic
        if (rocket.type === 'SPLITTER' && !rocket.hasSplit && rocket.y > CANVAS_HEIGHT * 0.4) {
          rocket.hasSplit = true;
          for (let i = 0; i < 3; i++) {
            const subTarget = citiesRef.current.filter(c => !c.isDestroyed)[Math.floor(Math.random() * citiesRef.current.length)] || rocket;
            rocketsRef.current.push({
              id: Math.random().toString(36).substr(2, 9),
              x: rocket.x,
              y: rocket.y,
              targetX: subTarget.x + (Math.random() * 100 - 50),
              targetY: subTarget.y,
              speed: rocket.speed * 1.2,
              type: 'SUB',
              color: '#ffff88',
              size: 1.5
            });
          }
        }

        // Type specific movement
        let moveX = (dx / dist) * rocket.speed;
        let moveY = (dy / dist) * rocket.speed;

        if (rocket.type === 'ZIGZAG') {
          const perpX = -dy / dist;
          const perpY = dx / dist;
          const wave = Math.sin(time / 100 + (rocket.offset || 0)) * 2;
          moveX += perpX * wave;
          moveY += perpY * wave;
        } else if (rocket.type === 'ACCEL') {
          rocket.speed += 0.02;
        } else if (rocket.type === 'STEALTH') {
          rocket.opacity = 0.3 + Math.sin(time / 200) * 0.7;
        }

        if (dist < 2) {
          const isNuclear = rocket.type === 'NUCLEAR';
          explosionsRef.current.push({
            id: 'hit-' + rocket.id,
            x: rocket.targetX,
            y: rocket.targetY,
            radius: 0,
            maxRadius: isNuclear ? 200 : 30,
            growing: true,
            opacity: 1
          });
          
          const destructionRadius = isNuclear ? 150 : 20;
          citiesRef.current.forEach(city => {
            if (Math.hypot(city.x - rocket.targetX, city.y - rocket.targetY) < (isNuclear ? 120 : 15)) city.isDestroyed = true;
          });
          turretsRef.current.forEach(turret => {
            if (Math.hypot(turret.x - rocket.targetX, turret.y - rocket.targetY) < (isNuclear ? 120 : 20)) turret.isDestroyed = true;
          });

          rocketsRef.current.splice(index, 1);
        } else {
          rocket.x += moveX;
          rocket.y += moveY;
        }
      });

      interceptorsRef.current.forEach((inter, index) => {
        const dx = inter.targetX - inter.x;
        const dy = inter.targetY - inter.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
          let radius = EXPLOSION_MAX_RADIUS;
          if (inter.isSpecial) {
            radius = inter.turretId === 1 ? 250 : 100;
          } else if (inter.turretId === 1) {
            radius = 80; // Main cannon default radius increased
          }

          explosionsRef.current.push({
            id: 'exp-' + inter.id,
            x: inter.targetX,
            y: inter.targetY,
            radius: 0,
            maxRadius: radius,
            growing: true,
            opacity: 1
          });
          interceptorsRef.current.splice(index, 1);
        } else {
          inter.x += (dx / dist) * inter.speed;
          inter.y += (dy / dist) * inter.speed;
        }
      });

      explosionsRef.current.forEach((exp, index) => {
        if (exp.growing) {
          exp.radius += EXPLOSION_SPEED;
          if (exp.radius >= exp.maxRadius) exp.growing = false;
        } else {
          exp.opacity -= 0.02;
          if (exp.opacity <= 0) explosionsRef.current.splice(index, 1);
        }

        rocketsRef.current.forEach((rocket, rIndex) => {
          if (Math.hypot(rocket.x - exp.x, rocket.y - exp.y) < exp.radius) {
            rocketsRef.current.splice(rIndex, 1);
            setScore(s => s + 20);
          }
        });

        // Damage Boss
        if (bossRef.current.active) {
          const dist = Math.hypot(bossRef.current.x - exp.x, bossRef.current.y - exp.y);
          if (dist < exp.radius + 50) {
            bossRef.current.hp -= 1; // Damage over time while in explosion
            setBossHp(bossRef.current.hp);
            if (bossRef.current.hp <= 0) {
              bossRef.current.active = false;
              setBossActive(false);
              setScore(s => s + 500);
              // Big explosion
              explosionsRef.current.push({
                id: 'boss-death',
                x: bossRef.current.x,
                y: bossRef.current.y,
                radius: 0,
                maxRadius: 300,
                growing: true,
                opacity: 1
              });
            }
          }
        }
      });

      if (turretsRef.current.every(t => t.isDestroyed)) setGameState('GAME_OVER');
      
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw Alien Starry Sky
      ctx.fillStyle = '#050208'; // Deep purple/black
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Nebula
      const nebulaGrad = ctx.createRadialGradient(CANVAS_WIDTH * 0.7, CANVAS_HEIGHT * 0.3, 0, CANVAS_WIDTH * 0.7, CANVAS_HEIGHT * 0.3, 400);
      nebulaGrad.addColorStop(0, 'rgba(120, 0, 200, 0.2)');
      nebulaGrad.addColorStop(0.5, 'rgba(50, 0, 100, 0.1)');
      nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Floating Alien Particles
      for (let i = 0; i < 30; i++) {
        const x = (Math.sin(i * 123 + time / 2000) * 0.5 + 0.5) * CANVAS_WIDTH;
        const y = (Math.cos(i * 456 + time / 3000) * 0.5 + 0.5) * CANVAS_HEIGHT;
        ctx.fillStyle = i % 2 === 0 ? '#00ffff' : '#ff00ff';
        ctx.globalAlpha = 0.1 + Math.sin(time / 1000 + i) * 0.1;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 100; i++) {
        const x = (Math.sin(i * 123.456) * 0.5 + 0.5) * CANVAS_WIDTH;
        const y = (Math.cos(i * 456.789) * 0.5 + 0.5) * CANVAS_HEIGHT;
        const s = (Math.sin(time / 500 + i) * 0.5 + 0.5) * 1.5;
        ctx.globalAlpha = 0.3 + Math.sin(time / 1000 + i) * 0.2;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1.0;

      // Draw Boss
      if (bossRef.current.active) {
        const boss = bossRef.current;
        ctx.save();
        ctx.translate(boss.x, boss.y);
        
        // Shield Ripple Effect
        const shieldPulse = (Math.sin(time / 200) + 1) / 2;
        ctx.strokeStyle = boss.type === 'HARBINGER' ? `rgba(255, 0, 255, ${0.1 + shieldPulse * 0.2})` : `rgba(0, 255, 255, ${0.1 + shieldPulse * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const shieldW = boss.type === 'HARBINGER' ? 120 : 100;
        const shieldH = boss.type === 'HARBINGER' ? 60 : 40;
        ctx.ellipse(0, 0, shieldW + shieldPulse * 5, shieldH + shieldPulse * 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Engine Exhaust
        const flicker = Math.random() * 10;
        const engineColor = boss.type === 'DESTROYER' ? '#00ff00' : boss.type === 'HARBINGER' ? '#ff00ff' : '#00ffff';
        const engineGrad = ctx.createLinearGradient(0, 0, 0, -40);
        engineGrad.addColorStop(0, engineColor);
        engineGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = engineGrad;
        
        if (boss.type === 'DESTROYER') {
          // Triple engines
          [-40, 0, 40].forEach(ox => {
            ctx.beginPath();
            ctx.moveTo(ox - 10, 10); ctx.lineTo(ox - flicker, 40); ctx.lineTo(ox + 10, 10);
            ctx.fill();
          });
        } else {
          // Dual engines
          ctx.beginPath();
          ctx.moveTo(-50, 10); ctx.lineTo(-70 - flicker, 30); ctx.lineTo(-30, 10);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(50, 10); ctx.lineTo(70 + flicker, 30); ctx.lineTo(30, 10);
          ctx.fill();
        }

        // Ship Body
        if (boss.type === 'MOTHERSHIP') {
          ctx.fillStyle = '#1a2533';
          ctx.strokeStyle = '#3498db';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-80, 0); ctx.lineTo(-40, -25); ctx.lineTo(40, -25); ctx.lineTo(80, 0); ctx.lineTo(40, 25); ctx.lineTo(-40, 25);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          
          ctx.fillStyle = '#2c3e50';
          ctx.beginPath();
          ctx.moveTo(-30, -25); ctx.lineTo(-15, -45); ctx.lineTo(15, -45); ctx.lineTo(30, -25);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (boss.type === 'DESTROYER') {
          // Sharp, aggressive shape
          ctx.fillStyle = '#2d3436';
          ctx.strokeStyle = '#2ecc71';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -40); ctx.lineTo(60, 10); ctx.lineTo(30, 30); ctx.lineTo(-30, 30); ctx.lineTo(-60, 10);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          
          // Side wings
          ctx.beginPath();
          ctx.moveTo(60, 10); ctx.lineTo(90, 20); ctx.lineTo(60, 30); ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-60, 10); ctx.lineTo(-90, 20); ctx.lineTo(-60, 30); ctx.fill(); ctx.stroke();
        } else {
          // Harbinger: Massive, imposing
          ctx.fillStyle = '#2c003e';
          ctx.strokeStyle = '#e056fd';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-100, 0); ctx.lineTo(-60, -50); ctx.lineTo(60, -50); ctx.lineTo(100, 0); ctx.lineTo(60, 50); ctx.lineTo(-60, 50);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          
          // Glowing vents
          ctx.fillStyle = '#ff00ff';
          ctx.globalAlpha = 0.3 + Math.sin(time / 200) * 0.2;
          ctx.fillRect(-40, -30, 80, 10);
          ctx.fillRect(-40, 20, 80, 10);
          ctx.globalAlpha = 1.0;
        }

        // Glowing Core
        const coreGlow = (Math.sin(time / 100) + 1) / 2;
        const coreColor = boss.type === 'DESTROYER' ? '#2ecc71' : boss.type === 'HARBINGER' ? '#ff00ff' : '#00ffff';
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        coreGrad.addColorStop(0, '#fff');
        coreGrad.addColorStop(0.5, coreColor);
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.globalAlpha = 0.5 + coreGlow * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.restore();
      }

      // Draw Alien Planet
      ctx.save();
      const planetX = 120;
      const planetY = 120;
      const planetR = 60;
      
      // Multi-layered Atmosphere
      for (let i = 3; i > 0; i--) {
        const atmosGrad = ctx.createRadialGradient(planetX, planetY, planetR, planetX, planetY, planetR + i * 10);
        atmosGrad.addColorStop(0, `rgba(0, 255, 255, ${0.1 * (4 - i)})`);
        atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = atmosGrad;
        ctx.beginPath();
        ctx.arc(planetX, planetY, planetR + i * 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet Body with Shadow
      const planetGrad = ctx.createRadialGradient(planetX - 25, planetY - 25, 5, planetX, planetY, planetR);
      planetGrad.addColorStop(0, '#4facfe');
      planetGrad.addColorStop(0.6, '#0061ff');
      planetGrad.addColorStop(1, '#001a4d'); // Dark side
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
      ctx.fill();

      // Glowing City Lights on Dark Side
      ctx.fillStyle = '#f1c40f';
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 15; i++) {
        const angle = Math.PI * 0.2 + Math.random() * Math.PI * 0.8;
        const dist = planetR * 0.4 + Math.random() * planetR * 0.5;
        const lx = planetX + Math.cos(angle) * dist;
        const ly = planetY + Math.sin(angle) * dist;
        // Only draw on the "dark" side (bottom right)
        if (lx > planetX - 10 && ly > planetY - 10) {
          ctx.beginPath();
          ctx.arc(lx, ly, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      // Planet Rings (Detailed)
      const ringAngle = Math.PI / 6;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + i * 0.05})`;
        ctx.lineWidth = 2 + i;
        ctx.beginPath();
        ctx.ellipse(planetX, planetY, planetR * (2.1 + i * 0.2), planetR * (0.4 + i * 0.05), ringAngle, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Surface Details (Animated Clouds)
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const speed = 0.0005 + i * 0.0001;
        const cx = planetX + Math.sin(time * speed + i * 10) * 40;
        const cy = planetY + Math.cos(i * 5) * 30;
        const size = 10 + Math.sin(time * 0.001 + i) * 5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, size, size / 3, ringAngle + i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();

      // Draw Alien Ground
      const groundGrad = ctx.createLinearGradient(0, 550, 0, 600);
      groundGrad.addColorStop(0, '#1a0a2e'); // Dark purple top
      groundGrad.addColorStop(1, '#0a0515'); // Near black bottom
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 550, CANVAS_WIDTH, 50);

      // Draw Ground Texture (Cracks/Glow)
      ctx.strokeStyle = '#4a1a8e';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(i * 99) * 0.5 + 0.5) * CANVAS_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, 550);
        ctx.lineTo(x + (Math.cos(i) * 20), 600);
        ctx.stroke();
      }

      // Draw Alien Crystals/Plants
      for (let i = 0; i < 15; i++) {
        const x = (Math.sin(i * 77) * 0.5 + 0.5) * CANVAS_WIDTH;
        if (citiesRef.current.some(c => Math.abs(c.x - x) < 40)) continue; // Don't draw on cities
        
        ctx.fillStyle = i % 2 === 0 ? '#00ffff' : '#ff00ff';
        ctx.globalAlpha = 0.4 + Math.sin(time / 500 + i) * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, 550);
        ctx.lineTo(x - 5, 535);
        ctx.lineTo(x + 5, 535);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      citiesRef.current.forEach(city => {
        if (!city.isDestroyed) {
          // Modern Bunker / Tech Building
          ctx.fillStyle = '#2c3e50';
          ctx.fillRect(city.x - 15, city.y - 12, 30, 22);
          
          // Roof detail
          ctx.fillStyle = '#34495e';
          ctx.beginPath();
          ctx.moveTo(city.x - 18, city.y + 10);
          ctx.lineTo(city.x - 12, city.y - 15);
          ctx.lineTo(city.x + 12, city.y - 15);
          ctx.lineTo(city.x + 18, city.y + 10);
          ctx.fill();

          // Windows / Lights
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(city.x - 8, city.y - 5, 4, 4);
          ctx.fillRect(city.x + 4, city.y - 5, 4, 4);
        } else {
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.ellipse(city.x, city.y + 5, 15, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      turretsRef.current.forEach(turret => {
        const isMainCannon = turret.id === 1;
        const baseColor = turret.isDestroyed ? '#222' : (isMainCannon ? '#2c3e50' : '#3a4a3a');
        const accentColor = turret.isDestroyed ? '#444' : (isMainCannon ? '#34495e' : '#5a6a5a');
        const detailColor = turret.isDestroyed ? '#111' : (isMainCannon ? '#bdc3c7' : '#a0b0a0');

        // 1. Draw Base Platform
        ctx.fillStyle = baseColor;
        const baseWidth = isMainCannon ? 70 : 50;
        ctx.fillRect(turret.x - baseWidth/2, turret.y - 5, baseWidth, 10);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(turret.x - baseWidth/2, turret.y - 5, baseWidth, 10);

        // 2. Draw Turret Body
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        const bodyWidth = isMainCannon ? 25 : 18;
        const bodyHeight = isMainCannon ? 25 : 15;
        ctx.moveTo(turret.x - bodyWidth, turret.y - 5);
        ctx.lineTo(turret.x - bodyWidth * 0.7, turret.y - 5 - bodyHeight);
        ctx.lineTo(turret.x + bodyWidth * 0.7, turret.y - 5 - bodyHeight);
        ctx.lineTo(turret.x + bodyWidth, turret.y - 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = detailColor;
        ctx.stroke();

        if (!turret.isDestroyed) {
          if (isMainCannon) {
            // Main Cannon Barrel (Heavy Railgun style)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(turret.x - 4, turret.y - 45, 8, 25);
            ctx.strokeStyle = detailColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(turret.x - 4, turret.y - 45, 8, 25);
            
            // Barrel details (rings)
            ctx.beginPath();
            ctx.moveTo(turret.x - 4, turret.y - 35); ctx.lineTo(turret.x + 4, turret.y - 35);
            ctx.moveTo(turret.x - 4, turret.y - 40); ctx.lineTo(turret.x + 4, turret.y - 40);
            ctx.stroke();
          } else {
            // Dual Barrels / Missile Pods
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(turret.x - 10, turret.y - 30, 6, 15);
            ctx.fillRect(turret.x + 4, turret.y - 30, 6, 15);
            ctx.strokeStyle = detailColor;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(turret.x - 10, turret.y - 30, 6, 15);
            ctx.strokeRect(turret.x + 4, turret.y - 30, 6, 15);
          }

          // 4. Status Light
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
          ctx.fillStyle = turret.missiles > 0 ? (isMainCannon ? `rgba(0, 200, 255, ${0.3 + pulse * 0.7})` : `rgba(0, 255, 100, ${0.3 + pulse * 0.7})`) : '#ff4444';
          ctx.beginPath();
          ctx.arc(turret.x, turret.y - (isMainCannon ? 18 : 12), isMainCannon ? 3 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      rocketsRef.current.forEach(rocket => {
        // 1. Draw Rocket Trail
        ctx.strokeStyle = rocket.color + '33';
        ctx.lineWidth = rocket.type === 'HEAVY' ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(rocket.x - (rocket.targetX - rocket.x) * 0.05, rocket.y - (rocket.targetY - rocket.y) * 0.05);
        ctx.lineTo(rocket.x, rocket.y);
        ctx.stroke();

        // 2. Calculate Angle
        const angle = Math.atan2(rocket.targetY - rocket.y, rocket.targetX - rocket.x);
        
        ctx.save();
        ctx.globalAlpha = rocket.opacity ?? 1.0;
        ctx.translate(rocket.x, rocket.y);
        ctx.rotate(angle);

        // 3. Draw Missile Body
        if (rocket.type === 'NUCLEAR') {
          // Fat bomb shape
          ctx.fillStyle = '#2d3436';
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Radioactive symbol (simplified)
          ctx.fillStyle = '#7cfc00';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Fins
          ctx.fillStyle = '#111';
          ctx.fillRect(-14, -6, 4, 12);
        } else if (rocket.type === 'SUPER_FAST') {
          // Needle shape
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-10, -2);
          ctx.lineTo(-10, 2);
          ctx.closePath();
          ctx.fill();
          
          // Electric glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00ffff';
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          const bodyLen = rocket.type === 'HEAVY' ? 12 : 8;
          const bodyWidth = rocket.type === 'HEAVY' ? 4 : 2;
          
          ctx.fillStyle = '#333'; // Dark missile body
          ctx.fillRect(-bodyLen/2, -bodyWidth/2, bodyLen, bodyWidth);
          
          // Nose cone
          ctx.fillStyle = rocket.color;
          ctx.beginPath();
          ctx.moveTo(bodyLen/2, -bodyWidth/2);
          ctx.lineTo(bodyLen/2 + 4, 0);
          ctx.lineTo(bodyLen/2, bodyWidth/2);
          ctx.fill();

          // Fins
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.moveTo(-bodyLen/2, -bodyWidth/2);
          ctx.lineTo(-bodyLen/2 - 3, -bodyWidth/2 - 2);
          ctx.lineTo(-bodyLen/2, -bodyWidth/2);
          ctx.moveTo(-bodyLen/2, bodyWidth/2);
          ctx.lineTo(-bodyLen/2 - 3, bodyWidth/2 + 2);
          ctx.lineTo(-bodyLen/2, bodyWidth/2);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0;

        // 4. Engine Flame
        if (rocket.type !== 'STEALTH' || (rocket.opacity ?? 1) > 0.5) {
          const flicker = Math.random() * 3;
          ctx.fillStyle = rocket.type === 'NUCLEAR' ? '#7cfc00' : rocket.type === 'SUPER_FAST' ? '#00ffff' : '#ff4400';
          const flameLen = rocket.type === 'SUPER_FAST' ? 15 : 5;
          const bodyLen = rocket.type === 'NUCLEAR' ? 24 : (rocket.type === 'HEAVY' ? 12 : 8);
          
          ctx.beginPath();
          ctx.moveTo(-bodyLen/2, -2);
          ctx.lineTo(-bodyLen/2 - flameLen - flicker, 0);
          ctx.lineTo(-bodyLen/2, 2);
          ctx.fill();
        }

        ctx.restore();
      });

      interceptorsRef.current.forEach(inter => {
        // 1. Draw Smoke Trail
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(inter.startX, inter.startY);
        ctx.lineTo(inter.x, inter.y);
        ctx.stroke();

        // 2. Calculate Angle for Rotation
        const angle = Math.atan2(inter.targetY - inter.startY, inter.targetX - inter.startX);
        
        ctx.save();
        ctx.translate(inter.x, inter.y);
        ctx.rotate(angle);

        // 3. Draw Missile Body
        ctx.fillStyle = '#d1d1d1'; // Light gray
        ctx.fillRect(-6, -1.5, 10, 3); // Main body
        
        // Nose cone
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(4, -1.5);
        ctx.lineTo(8, 0);
        ctx.lineTo(4, 1.5);
        ctx.fill();

        // Fins
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(-6, -1.5);
        ctx.lineTo(-9, -4);
        ctx.lineTo(-6, -1.5);
        ctx.moveTo(-6, 1.5);
        ctx.lineTo(-9, 4);
        ctx.lineTo(-6, 1.5);
        ctx.stroke();

        // 4. Engine Flame
        const flicker = Math.random() * 4;
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-6, -1);
        ctx.lineTo(-10 - flicker, 0);
        ctx.lineTo(-6, 1);
        ctx.fill();

        ctx.restore();

        // 5. Target Reticle (X)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(inter.targetX - 5, inter.targetY - 5);
        ctx.lineTo(inter.targetX + 5, inter.targetY + 5);
        ctx.moveTo(inter.targetX + 5, inter.targetY - 5);
        ctx.lineTo(inter.targetX - 5, inter.targetY + 5);
        ctx.stroke();
      });

      explosionsRef.current.forEach(exp => {
        const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${exp.opacity})`);
        gradient.addColorStop(0.4, `rgba(255, 200, 0, ${exp.opacity})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, round, spawnRocket]);

  useEffect(() => {
    if (score >= WIN_SCORE && gameState === 'PLAYING' && !bossRef.current.active) setGameState('SUCCESS');
  }, [score, gameState, bossActive]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      const interval = setInterval(() => {
        // Add remaining missiles to score
        let bonus = 0;
        turretsRef.current.forEach(t => {
          if (!t.isDestroyed) bonus += t.missiles * 5;
        });
        if (bonus > 0) setScore(s => s + bonus);

        setRound(r => {
          const nextRound = r + 1;
          // Reset boss spawn flag for new round
          bossRef.current.hasSpawnedThisRound = false;
          return nextRound;
        });
        turretsRef.current.forEach(t => {
          if (!t.isDestroyed) t.missiles = t.maxMissiles;
        });
      }, 20000);

      // Special Charge accumulation & Auto-trigger
      const chargeInterval = setInterval(() => {
        turretsRef.current.forEach(t => {
          if (!t.isDestroyed) {
            if (t.specialCharge < 100) {
              t.specialCharge = Math.min(100, t.specialCharge + 1);
            } else {
              // Auto-trigger when full
              triggerSpecial(t.id);
            }
          }
        });
      }, 200);

      return () => {
        clearInterval(interval);
        clearInterval(chargeInterval);
      };
    }
  }, [gameState]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    fireInterceptor((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-900/10 blur-[100px] rounded-full" />
      </div>

      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tighter text-white/90 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            {t.title}
          </h1>
          <div className="flex gap-4 text-xs font-mono text-white/50 uppercase tracking-widest">
            <span>{t.round}: {round}</span>
            <span>{t.score}: {score} / {WIN_SCORE}</span>
          </div>
        </div>
        <button onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          <Globe className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-4 left-0 w-full px-8 flex justify-between items-end z-20 pointer-events-none">
        {turretsRef.current.map((turret, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${turret.specialCharge >= 100 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                  style={{ width: `${turret.specialCharge}%` }}
                />
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(turret.missiles, 10) }).map((_, i) => (
                  <div key={i} className={`w-1 h-4 rounded-full ${turret.isDestroyed ? 'bg-red-900/50' : 'bg-emerald-400'}`} />
                ))}
                {turret.missiles > 10 && <span className="text-[10px] font-mono text-emerald-400">+{turret.missiles - 10}</span>}
              </div>
            </div>
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">{idx === 0 ? 'LEFT' : idx === 1 ? 'CENTER' : 'RIGHT'}</span>
          </div>
        ))}
      </div>

      {/* Boss HP Bar */}
      <AnimatePresence>
        {bossActive && (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
              className="absolute top-40 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
            >
              <div className="text-4xl font-black text-red-600 italic tracking-tighter animate-pulse drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                WARNING: BOSS INCOMING
              </div>
            </motion.div>
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30"
            >
            <div className="bg-black/50 backdrop-blur-md border border-red-500/30 rounded-full p-1 overflow-hidden">
              <div 
                className="h-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 px-2 text-[10px] font-mono text-red-500 uppercase tracking-widest font-bold">
              <span>{bossRef.current.type === 'MOTHERSHIP' ? 'Alien Mothership' : bossRef.current.type === 'DESTROYER' ? 'Void Destroyer' : 'Galactic Harbinger'}</span>
              <span>{Math.ceil(bossHp)} / {bossMaxHp}</span>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      <div className="relative aspect-[4/3] w-full max-w-4xl border border-white/10 shadow-2xl rounded-lg overflow-hidden bg-zinc-950">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onMouseDown={handleCanvasClick} onTouchStart={handleCanvasClick} className="w-full h-full cursor-crosshair" />
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                <Target className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-4xl font-bold mb-4 tracking-tight">{t.title}</h2>
              <p className="text-white/60 mb-8 leading-relaxed max-w-md">{t.instructions}</p>
              <button onClick={initGame} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto">
                <Zap className="w-5 h-5" />
                {t.start}
              </button>
            </motion.div>
          )}
          {(gameState === 'GAME_OVER' || gameState === 'SUCCESS') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-50">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                {gameState === 'SUCCESS' ? <Trophy className="w-12 h-12 text-yellow-400" /> : <RotateCcw className="w-12 h-12 text-red-400" />}
              </div>
              <h2 className={`text-5xl font-bold mb-2 tracking-tighter ${gameState === 'SUCCESS' ? 'text-emerald-400' : 'text-red-500'}`}>{gameState === 'SUCCESS' ? t.success : t.gameOver}</h2>
              <p className="text-white/50 mb-8 font-mono uppercase tracking-widest">{gameState === 'SUCCESS' ? t.winMsg : t.loseMsg}</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 w-full max-w-xs">
                <div className="flex justify-between items-center mb-2"><span className="text-white/40 text-sm uppercase">{t.score}</span><span className="text-2xl font-bold font-mono">{score}</span></div>
                <div className="flex justify-between items-center"><span className="text-white/40 text-sm uppercase">{t.round}</span><span className="text-2xl font-bold font-mono">{round}</span></div>
              </div>
              <button onClick={initGame} className="px-10 py-4 bg-white text-black font-bold rounded-2xl transition-all transform hover:scale-105 active:scale-95">{t.restart}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
