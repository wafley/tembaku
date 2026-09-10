import { events } from '../core/EventBus';
import { GameState } from '../types/state';
import { CONFIG } from '../config';
import { DifficultyLevel } from '../types';

export class UIManager {
  private hud = document.getElementById('hud');
  private damageOverlay = document.getElementById('damage-overlay');
  private healOverlay = document.getElementById('heal-overlay');
  private criticalOverlay = document.getElementById('critical-overlay');
  private bossAtmosphereOverlay = document.getElementById('boss-atmosphere-overlay');

  private bossHud = document.getElementById('boss-hud');
  private bossName = document.getElementById('boss-name');
  private bossHpText = document.getElementById('boss-hp-text');
  private bossBarFill = document.getElementById('boss-bar-fill');

  private hitMarker = document.getElementById('hit-marker');
  private emptyAmmoAlert = document.getElementById('empty-ammo-alert');
  private lowHpAlert = document.getElementById('low-hp-alert');
  private bossAlert = document.getElementById('boss-alert');

  private scoreVal = document.getElementById('score-val');
  private waveVal = document.getElementById('wave-val');
  private killsVal = document.getElementById('kills-val');
  private alertBanner = document.getElementById('alert-banner');

  private medkitStatus = document.getElementById('medkit-status');
  private healthVal = document.getElementById('health-val');
  private healthBarFill = document.getElementById('health-bar-fill');

  private ammoCur = document.getElementById('ammo-cur');
  private ammoMax = document.getElementById('ammo-max');
  private reloadPrompt = document.getElementById('reload-prompt');

  private menuOverlay = document.getElementById('menu-overlay');
  private startBtn = document.getElementById('start-btn');
  private gameOverOverlay = document.getElementById('gameover-overlay');

  private finalScore = document.getElementById('final-score');
  private finalKills = document.getElementById('final-kills');
  private finalWave = document.getElementById('final-wave');

  readonly mobileControls = document.getElementById('mobile-controls');
  readonly orientationOverlay = document.getElementById('orientation-overlay');

  private edgeArrowLeft = document.getElementById('edge-arrow-left');
  private edgeArrowRight = document.getElementById('edge-arrow-right');
  private edgeArrowBack = document.getElementById('edge-arrow-back');

  // Modals
  private settingsModal = document.getElementById('settings-modal');
  private tutorialModal = document.getElementById('tutorial-modal');
  private helpModal = document.getElementById('help-modal');
  private licenseModal = document.getElementById('license-modal');

  // Audio & Settings Controls
  private volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;
  private volumeVal = document.getElementById('volume-val');
  private muteToggleBtn = document.getElementById('mute-toggle-btn');
  private aimAssistToggleBtn = document.getElementById('aim-assist-toggle-btn');

  private desktopSensSlider = document.getElementById(
    'desktop-sens-slider'
  ) as HTMLInputElement | null;
  private desktopSensVal = document.getElementById('desktop-sens-val');
  private mobileSensSlider = document.getElementById(
    'mobile-sens-slider'
  ) as HTMLInputElement | null;
  private mobileSensVal = document.getElementById('mobile-sens-val');

  private isTouchDevice = false;
  private hitMarkerTimeout: ReturnType<typeof setTimeout> | null = null;
  activeDifficulty: DifficultyLevel = CONFIG.DEFAULT_DIFFICULTY;

  constructor() {
    const savedDiff = localStorage.getItem('tembaku_difficulty') as DifficultyLevel | null;
    if (savedDiff && CONFIG.DIFFICULTIES[savedDiff]) {
      this.activeDifficulty = savedDiff;
    }

    this.bindEvents();
    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());
  }

  setMobileMode(isMobile: boolean): void {
    this.isTouchDevice = isMobile;
    if (this.mobileControls) {
      if (!isMobile) {
        this.mobileControls.classList.add('hidden');
      }
    }

    const subnote = document.querySelector('.subnote') as HTMLElement | null;
    if (subnote && isMobile) {
      subnote.innerText = 'Sentuh tombol untuk masuk ke arena tempur FPS';
    }

    // Toggle sensitivity slider based on device
    const desktopRow = document.getElementById('desktop-sens-row');
    const mobileRow = document.getElementById('mobile-sens-row');

    if (isMobile) {
      if (desktopRow) desktopRow.classList.add('hidden');
      if (mobileRow) mobileRow.classList.remove('hidden');
    } else {
      if (desktopRow) desktopRow.classList.remove('hidden');
      if (mobileRow) mobileRow.classList.add('hidden');
    }

    this.checkOrientation();
  }

  initLobbyAndModals(soundManager: any, inputManager: any, player?: any): void {
    // 1. Lobby navigation buttons
    const bindModalOpen = (btnId: string, modal: HTMLElement | null) => {
      const btn = document.getElementById(btnId);
      if (btn && modal) {
        const handler = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.openModal(modal);
        };
        btn.addEventListener('click', handler);
        btn.addEventListener('touchend', handler);
      }
    };

    bindModalOpen('settings-btn', this.settingsModal);
    bindModalOpen('tutorial-btn', this.tutorialModal);
    bindModalOpen('help-btn', this.helpModal);
    bindModalOpen('license-btn', this.licenseModal);

    // 2. Modal Close Buttons
    const bindModalClose = (btnId: string, modal: HTMLElement | null) => {
      const btn = document.getElementById(btnId);
      if (btn && modal) {
        const handler = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal(modal);
        };
        btn.addEventListener('click', handler);
        btn.addEventListener('touchend', handler);
      }
    };

    bindModalClose('close-settings-btn', this.settingsModal);
    bindModalClose('save-settings-btn', this.settingsModal);
    bindModalClose('close-tutorial-btn', this.tutorialModal);
    bindModalClose('back-tutorial-btn', this.tutorialModal);
    bindModalClose('close-help-btn', this.helpModal);
    bindModalClose('back-help-btn', this.helpModal);
    bindModalClose('close-license-btn', this.licenseModal);
    bindModalClose('back-license-btn', this.licenseModal);

    // 3. Audio Volume Control
    if (this.volumeSlider && this.volumeVal) {
      this.volumeSlider.value = String(soundManager.masterVolume);
      this.volumeVal.innerText = `${Math.round(soundManager.masterVolume * 100)}%`;

      const updateVolume = () => {
        const val = parseFloat(this.volumeSlider!.value);
        soundManager.setVolume(val);
        this.volumeVal!.innerText = `${Math.round(val * 100)}%`;
      };

      this.volumeSlider.addEventListener('input', updateVolume);
      this.volumeSlider.addEventListener('change', updateVolume);
      this.volumeSlider.addEventListener('click', (e) => e.stopPropagation());
      this.volumeSlider.addEventListener('touchstart', (e) => e.stopPropagation(), {
        passive: true
      });
    }

    // 4. Audio Mute Toggle
    if (this.muteToggleBtn) {
      const updateMuteUI = () => {
        if (soundManager.isMuted) {
          this.muteToggleBtn!.innerText = '🔇 SUARA: BISU';
          this.muteToggleBtn!.classList.remove('active');
        } else {
          this.muteToggleBtn!.innerText = '🔊 SUARA: AKTIF';
          this.muteToggleBtn!.classList.add('active');
        }
      };
      updateMuteUI();

      const toggleHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        soundManager.toggleMute();
        updateMuteUI();
      };
      this.muteToggleBtn.addEventListener('click', toggleHandler);
      this.muteToggleBtn.addEventListener('touchend', toggleHandler);
    }

    // 5. Aim Assist Toggle
    if (this.aimAssistToggleBtn) {
      const savedAimAssist = localStorage.getItem('tembaku_aim_assist');
      let aimAssistActive = savedAimAssist !== 'false';
      if (player) {
        player.aimAssistEnabled = aimAssistActive;
      }

      const updateAimAssistUI = () => {
        if (aimAssistActive) {
          this.aimAssistToggleBtn!.innerText = '🎯 AIM ASSIST: ON';
          this.aimAssistToggleBtn!.classList.add('active');
        } else {
          this.aimAssistToggleBtn!.innerText = '⚪ AIM ASSIST: OFF';
          this.aimAssistToggleBtn!.classList.remove('active');
        }
      };
      updateAimAssistUI();

      const toggleHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        aimAssistActive = !aimAssistActive;
        try {
          localStorage.setItem('tembaku_aim_assist', String(aimAssistActive));
        } catch {}
        if (player) {
          player.aimAssistEnabled = aimAssistActive;
        }
        updateAimAssistUI();
      };
      this.aimAssistToggleBtn.addEventListener('click', toggleHandler);
      this.aimAssistToggleBtn.addEventListener('touchend', toggleHandler);
    }

    // 6. Difficulty Selection
    this.bindDifficultyControls();

    // 7. Sensitivity Controls
    this.bindSensitivityControls(inputManager);

    // Prevent backdrop clicks on modal cards from propagating to lobby
    const modalCards = document.querySelectorAll('.modal-card');
    modalCards.forEach((card) => {
      card.addEventListener('click', (e) => e.stopPropagation());
      card.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });
  }

  private bindDifficultyControls(): void {
    const lobbyTabs = document.querySelectorAll('#lobby-diff-tabs .diff-tab');
    const modalTabs = document.querySelectorAll('#modal-diff-tabs .diff-tab');
    const lobbyTagline = document.getElementById('lobby-diff-tagline');
    const modalDesc = document.getElementById('modal-diff-desc');

    const descriptions: Record<DifficultyLevel, string> = {
      RECRUIT:
        'RECRUIT: Kasual & santai. HP musuh moderat, stim heal +35 HP, toleransi invulnerability tinggi. Pengali skor 0.8x.',
      OPERATIVE:
        'OPERATIVE: Standar seimbang. Ritme drone agresif normal, bos Titan tangguh, stim heal +25 HP. Pengali skor 1.0x.',
      VETERAN:
        'CYBER VETERAN: Mode hardcore! HP pemain 80, drone sangat agresif & akurat, serangan bos lebih cepat. Pengali skor 1.5x.'
    };

    const updateUI = () => {
      const diff = CONFIG.DIFFICULTIES[this.activeDifficulty];
      if (lobbyTagline) {
        lobbyTagline.innerText = `${diff.name} // Score x${diff.scoreMultiplier.toFixed(1)}`;
      }
      if (modalDesc) {
        modalDesc.innerText = descriptions[this.activeDifficulty] || '';
      }

      const syncButtons = (buttons: NodeListOf<Element>) => {
        buttons.forEach((btn) => {
          const targetDiff = btn.getAttribute('data-diff');
          if (targetDiff === this.activeDifficulty) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      };

      syncButtons(lobbyTabs);
      syncButtons(modalTabs);
    };

    const handleSelect = (e: Event, btn: Element) => {
      e.preventDefault();
      e.stopPropagation();
      const selected = btn.getAttribute('data-diff') as DifficultyLevel;
      if (selected && CONFIG.DIFFICULTIES[selected]) {
        this.activeDifficulty = selected;
        try {
          localStorage.setItem('tembaku_difficulty', selected);
        } catch {}
        events.emit('difficulty:change', CONFIG.DIFFICULTIES[selected]);
        updateUI();
      }
    };

    const attachListeners = (buttons: NodeListOf<Element>) => {
      buttons.forEach((btn) => {
        btn.addEventListener('click', (e) => handleSelect(e, btn));
        btn.addEventListener('touchend', (e) => handleSelect(e, btn));
      });
    };

    attachListeners(lobbyTabs);
    attachListeners(modalTabs);

    // Initial broadcast and UI sync
    events.emit('difficulty:change', CONFIG.DIFFICULTIES[this.activeDifficulty]);
    updateUI();
  }

  openModal(modal: HTMLElement | null): void {
    this.closeAllModals();
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  closeModal(modal: HTMLElement | null): void {
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  closeAllModals(): void {
    if (this.settingsModal) this.settingsModal.classList.add('hidden');
    if (this.tutorialModal) this.tutorialModal.classList.add('hidden');
    if (this.helpModal) this.helpModal.classList.add('hidden');
    if (this.licenseModal) this.licenseModal.classList.add('hidden');
  }

  bindSensitivityControls(inputManager: any): void {
    if (this.desktopSensSlider && this.desktopSensVal) {
      this.desktopSensSlider.value = String(inputManager.desktopSensMultiplier);
      this.desktopSensVal.innerText = `${inputManager.desktopSensMultiplier.toFixed(1)}x`;

      const updateDesktop = () => {
        const val = parseFloat(this.desktopSensSlider!.value);
        inputManager.setDesktopSensitivity(val);
        this.desktopSensVal!.innerText = `${val.toFixed(1)}x`;
      };

      this.desktopSensSlider.addEventListener('input', updateDesktop);
      this.desktopSensSlider.addEventListener('change', updateDesktop);
      this.desktopSensSlider.addEventListener('click', (e) => e.stopPropagation());
      this.desktopSensSlider.addEventListener('touchstart', (e) => e.stopPropagation(), {
        passive: true
      });
    }

    if (this.mobileSensSlider && this.mobileSensVal) {
      this.mobileSensSlider.value = String(inputManager.mobileSensMultiplier);
      this.mobileSensVal.innerText = `${inputManager.mobileSensMultiplier.toFixed(1)}x`;

      const updateMobile = () => {
        const val = parseFloat(this.mobileSensSlider!.value);
        inputManager.setMobileSensitivity(val);
        this.mobileSensVal!.innerText = `${val.toFixed(1)}x`;
      };

      this.mobileSensSlider.addEventListener('input', updateMobile);
      this.mobileSensSlider.addEventListener('change', updateMobile);
      this.mobileSensSlider.addEventListener('click', (e) => e.stopPropagation());
      this.mobileSensSlider.addEventListener('touchstart', (e) => e.stopPropagation(), {
        passive: true
      });
    }
  }

  checkOrientation(): void {
    if (!this.orientationOverlay) return;

    const isMobileTouch = this.isTouchDevice || window.matchMedia('(pointer: coarse)').matches;
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isMobileTouch && isPortrait) {
      this.orientationOverlay.classList.remove('hidden');
    } else {
      this.orientationOverlay.classList.add('hidden');
    }
  }

  private bindEvents(): void {
    events.on('state:change', ({ to }) => {
      this.handleStateChange(to);
    });

    events.on('player:health', ({ current, max }) => {
      this.updateHealth(current, max);
    });

    events.on('player:damage', () => {
      this.showDamageFlash();
    });

    events.on('player:heal', () => {
      this.showHealFlash();
    });

    events.on('player:medkit', ({ ready, cooldown }) => {
      this.updateMedkit(ready, cooldown);
    });

    events.on('weapon:ammo', ({ current, max, empty }) => {
      this.updateAmmo(current, max, empty);
    });

    events.on('weapon:reload_start', () => {
      if (this.reloadPrompt) this.reloadPrompt.classList.add('hidden');
      if (this.emptyAmmoAlert) this.emptyAmmoAlert.classList.add('hidden');
    });

    events.on('weapon:hit_enemy', () => {
      this.showHitMarker();
    });

    events.on('stats:update', ({ score, wave, kills }) => {
      this.updateStats(score, wave, kills);
    });

    events.on('wave:banner', ({ text, isFlawless, duration }) => {
      this.showAlertBanner(text, isFlawless, duration);
    });

    events.on('boss:spawn', ({ name, health, maxHealth }) => {
      this.showBossHUD(name, health, maxHealth);
    });

    events.on('boss:health', ({ current, max }) => {
      this.updateBossHealth(current, max);
    });

    events.on('boss:defeated', () => {
      this.hideBossHUD();
    });

    events.on('game:over', ({ score, kills, wave }) => {
      this.showGameOver(score, kills, wave);
    });
  }

  private handleStateChange(state: GameState): void {
    switch (state) {
      case 'MENU':
        this.closeAllModals();
        if (this.menuOverlay) this.menuOverlay.classList.remove('hidden');
        if (this.gameOverOverlay) this.gameOverOverlay.classList.add('hidden');
        if (this.hud) this.hud.classList.add('hidden');
        if (this.mobileControls) this.mobileControls.classList.add('hidden');
        this.updateStartButtonText('MULAI PERMAINAN');
        break;

      case 'PLAYING':
        this.closeAllModals();
        if (this.menuOverlay) this.menuOverlay.classList.add('hidden');
        if (this.gameOverOverlay) this.gameOverOverlay.classList.add('hidden');
        if (this.hud) this.hud.classList.remove('hidden');
        if (this.mobileControls && this.isTouchDevice) {
          this.mobileControls.classList.remove('hidden');
        }
        break;

      case 'PAUSED':
        if (this.menuOverlay) this.menuOverlay.classList.remove('hidden');
        if (this.mobileControls) this.mobileControls.classList.add('hidden');
        this.updateStartButtonText('LANJUTKAN MISI');
        break;

      case 'GAMEOVER':
        this.closeAllModals();
        if (this.hud) this.hud.classList.add('hidden');
        if (this.mobileControls) this.mobileControls.classList.add('hidden');
        if (this.gameOverOverlay) this.gameOverOverlay.classList.remove('hidden');
        this.hideBossHUD();
        break;
    }
  }

  private updateStartButtonText(text: string): void {
    if (!this.startBtn) return;
    const btnText = this.startBtn.querySelector('.btn-text');
    if (btnText) {
      (btnText as HTMLElement).innerText = text;
    } else {
      this.startBtn.innerText = text;
    }
  }

  updateHealth(current: number, max: number): void {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    if (this.healthVal) {
      this.healthVal.innerText = `${Math.round(pct)}%`;
      if (pct < 30) {
        this.healthVal.style.color = '#ff2255';
        if (this.healthBarFill) this.healthBarFill.classList.add('critical');
        if (this.criticalOverlay) this.criticalOverlay.classList.add('active');
        if (this.lowHpAlert) this.lowHpAlert.classList.remove('hidden');
      } else {
        this.healthVal.style.color = '#00ff88';
        if (this.healthBarFill) this.healthBarFill.classList.remove('critical');
        if (this.criticalOverlay) this.criticalOverlay.classList.remove('active');
        if (this.lowHpAlert) this.lowHpAlert.classList.add('hidden');
      }
    }
    if (this.healthBarFill) {
      this.healthBarFill.style.width = `${pct}%`;
    }
  }

  updateMedkit(ready: boolean, cooldown: number): void {
    if (!this.medkitStatus) return;
    if (ready) {
      this.medkitStatus.innerText = 'READY (+25 HP)';
      this.medkitStatus.className = 'medkit-status ready';
    } else {
      this.medkitStatus.innerText = `COOLDOWN: ${Math.ceil(cooldown)}s`;
      this.medkitStatus.className = 'medkit-status cooldown';
    }
  }

  updateAmmo(current: number, max: number, empty: boolean): void {
    if (this.ammoCur) {
      this.ammoCur.innerText = String(current);
      if (current <= 5) {
        this.ammoCur.classList.add('low');
      } else {
        this.ammoCur.classList.remove('low');
      }
    }
    if (this.ammoMax) {
      this.ammoMax.innerText = String(max);
    }

    if (empty) {
      if (this.emptyAmmoAlert) this.emptyAmmoAlert.classList.remove('hidden');
      if (this.reloadPrompt) this.reloadPrompt.classList.remove('hidden');
    } else {
      if (this.emptyAmmoAlert) this.emptyAmmoAlert.classList.add('hidden');
      if (this.reloadPrompt) this.reloadPrompt.classList.add('hidden');
    }
  }

  updateStats(score: number, wave: number, kills: number): void {
    if (this.scoreVal) this.scoreVal.innerText = String(score).padStart(4, '0');
    if (this.waveVal) this.waveVal.innerText = String(wave);
    if (this.killsVal) this.killsVal.innerText = String(kills);
  }

  showDamageFlash(): void {
    if (!this.damageOverlay) return;
    this.damageOverlay.style.opacity = '1';
    setTimeout(() => {
      if (this.damageOverlay) this.damageOverlay.style.opacity = '0';
    }, 150);
  }

  showHealFlash(): void {
    if (!this.healOverlay) return;
    this.healOverlay.style.opacity = '1';
    setTimeout(() => {
      if (this.healOverlay) this.healOverlay.style.opacity = '0';
    }, 200);
  }

  showHitMarker(): void {
    if (!this.hitMarker) return;
    this.hitMarker.classList.add('active');
    if (this.hitMarkerTimeout) clearTimeout(this.hitMarkerTimeout);
    this.hitMarkerTimeout = setTimeout(() => {
      if (this.hitMarker) this.hitMarker.classList.remove('active');
    }, 90);
  }

  showAlertBanner(text: string, isFlawless = false, duration = 2400): void {
    if (!this.alertBanner) return;
    this.alertBanner.innerText = text;
    if (isFlawless) {
      this.alertBanner.classList.add('flawless');
    } else {
      this.alertBanner.classList.remove('flawless');
    }
    this.alertBanner.classList.remove('hidden');

    setTimeout(() => {
      if (this.alertBanner) {
        this.alertBanner.classList.add('hidden');
        this.alertBanner.classList.remove('flawless');
      }
    }, duration);
  }

  showBossHUD(name: string, health: number, maxHealth: number): void {
    if (this.bossHud) this.bossHud.classList.remove('hidden');
    if (this.bossName) this.bossName.innerText = name;
    if (this.bossAtmosphereOverlay) this.bossAtmosphereOverlay.classList.add('active');
    if (this.bossAlert) this.bossAlert.classList.remove('hidden');
    this.updateBossHealth(health, maxHealth);
  }

  updateBossHealth(health: number, maxHealth: number): void {
    const pct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    if (this.bossHpText) this.bossHpText.innerText = `${Math.ceil(pct)}%`;
    if (this.bossBarFill) this.bossBarFill.style.width = `${pct}%`;
  }

  hideBossHUD(): void {
    if (this.bossHud) this.bossHud.classList.add('hidden');
    if (this.bossAtmosphereOverlay) this.bossAtmosphereOverlay.classList.remove('active');
    if (this.bossAlert) this.bossAlert.classList.add('hidden');
  }

  showGameOver(score: number, kills: number, wave: number): void {
    if (this.finalScore) this.finalScore.innerText = String(score);
    if (this.finalKills) this.finalKills.innerText = String(kills);
    if (this.finalWave) this.finalWave.innerText = String(wave);

    if (this.criticalOverlay) this.criticalOverlay.classList.remove('active');
    if (this.lowHpAlert) this.lowHpAlert.classList.add('hidden');
    if (this.emptyAmmoAlert) this.emptyAmmoAlert.classList.add('hidden');
    this.hideThreatIndicators();
  }

  hideThreatIndicators(): void {
    if (this.edgeArrowLeft) this.edgeArrowLeft.classList.add('hidden');
    if (this.edgeArrowRight) this.edgeArrowRight.classList.add('hidden');
    if (this.edgeArrowBack) this.edgeArrowBack.classList.add('hidden');
  }

  updateThreatIndicators(
    camPosition: { x: number; y: number; z: number },
    camForward: { x: number; y: number; z: number },
    camRight: { x: number; y: number; z: number },
    enemies: any[]
  ): void {
    if (!enemies || enemies.length === 0) {
      this.hideThreatIndicators();
      return;
    }

    let closestDist = Infinity;
    let closestToEnemy: { x: number; y: number; z: number } | null = null;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead || !e.group) continue;
      const ex = e.group.position.x - camPosition.x;
      const ey = e.group.position.y - camPosition.y;
      const ez = e.group.position.z - camPosition.z;
      const d = Math.hypot(ex, ey, ez);
      if (d < closestDist) {
        closestDist = d;
        closestToEnemy = { x: ex / d, y: ey / d, z: ez / d };
      }
    }

    if (!closestToEnemy) {
      this.hideThreatIndicators();
      return;
    }

    const dotFwd =
      camForward.x * closestToEnemy.x +
      camForward.y * closestToEnemy.y +
      camForward.z * closestToEnemy.z;
    const dotRt =
      camRight.x * closestToEnemy.x + camRight.y * closestToEnemy.y + camRight.z * closestToEnemy.z;

    if (dotFwd > 0.88) {
      this.hideThreatIndicators();
      return;
    }

    if (this.edgeArrowLeft) {
      if (dotRt < -0.32) {
        this.edgeArrowLeft.classList.remove('hidden');
      } else {
        this.edgeArrowLeft.classList.add('hidden');
      }
    }

    if (this.edgeArrowRight) {
      if (dotRt > 0.32) {
        this.edgeArrowRight.classList.remove('hidden');
      } else {
        this.edgeArrowRight.classList.add('hidden');
      }
    }

    if (this.edgeArrowBack) {
      if (dotFwd < -0.2) {
        this.edgeArrowBack.classList.remove('hidden');
      } else {
        this.edgeArrowBack.classList.add('hidden');
      }
    }
  }
}
