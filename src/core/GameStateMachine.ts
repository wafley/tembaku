import { GameState } from '../types/state';
import { events } from './EventBus';

export class GameStateMachine {
  private currentState: GameState = 'BOOT';

  private allowedTransitions: Record<GameState, GameState[]> = {
    BOOT: ['MENU'],
    MENU: ['PLAYING'],
    PLAYING: ['PAUSED', 'GAMEOVER'],
    PAUSED: ['PLAYING', 'MENU', 'GAMEOVER'],
    GAMEOVER: ['PLAYING', 'MENU']
  };

  get state(): GameState {
    return this.currentState;
  }

  canTransitionTo(nextState: GameState): boolean {
    return this.allowedTransitions[this.currentState].includes(nextState);
  }

  transitionTo(nextState: GameState): boolean {
    if (!this.canTransitionTo(nextState)) {
      console.warn(`[GameStateMachine] Invalid transition: ${this.currentState} -> ${nextState}`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = nextState;
    console.log(`[GameStateMachine] State: ${previousState} -> ${nextState}`);

    events.emit('state:change', { from: previousState, to: nextState });
    return true;
  }

  is(state: GameState): boolean {
    return this.currentState === state;
  }
}
