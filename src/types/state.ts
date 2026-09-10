export type GameState = 'BOOT' | 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface GameStateChangeEvent {
  from: GameState;
  to: GameState;
}
