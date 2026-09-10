import { GameState } from './state';
import { DifficultyConfig } from './index';

export interface EventMap {
  // State
  'state:change': { from: GameState; to: GameState };

  // Difficulty
  'difficulty:change': DifficultyConfig;

  // Input
  'input:lock_change': boolean;

  // Player
  'player:health': { current: number; max: number };
  'player:damage': { amount: number; health: number };
  'player:heal': { amount: number; health: number };
  'player:medkit': { ready: boolean; cooldown: number };
  'player:dead': void;

  // Weapon
  'weapon:ammo': { current: number; max: number; empty: boolean };
  'weapon:reload_start': void;
  'weapon:reload_done': void;
  'weapon:hit_enemy': void;
  'weapon:recoil_kick': { pitch: number; yaw: number };

  // Stats & Waves
  'stats:update': { score: number; wave: number; kills: number };
  'wave:banner': { text: string; isFlawless: boolean; duration: number };

  // Boss
  'boss:spawn': { name: string; health: number; maxHealth: number };
  'boss:health': { current: number; max: number };
  'boss:defeated': void;

  // Game
  'game:start': void;
  'game:pause': void;
  'game:resume': void;
  'game:over': { score: number; kills: number; wave: number };
  'game:restart': void;

  // Sound triggers
  'sound:shoot': void;
  'sound:hit_enemy': void;
  'sound:enemy_shoot': void;
  'sound:player_hit': void;
  'sound:explosion': void;
  'sound:reload': void;
  'sound:empty': void;
  'sound:empty_warning': void;
  'sound:jump': void;
  'sound:footstep': void;
  'sound:wave_alert': void;
  'sound:flawless': void;
  'sound:heal': void;
  'sound:boss_warning': void;
  'sound:boss_shoot': void;
  'sound:heartbeat': void;
}
