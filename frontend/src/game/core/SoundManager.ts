import * as THREE from 'three';

export class SoundManager {
    private static instance: SoundManager;
    private backgroundMusic: HTMLAudioElement | null = null;
    private isMusicPlaying: boolean = false;
    private volume: number = 0.5;

    private constructor() {
        // Initialize background music
        this.backgroundMusic = new Audio('/sounds/tron_legacy.mp3');
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = this.volume * 0.7;

        // Enhanced audio loading logs
        this.backgroundMusic.addEventListener('canplaythrough', () => {
            console.log('[SoundManager] Background music loaded successfully.');
            // Start background music immediately when loaded
            this.startBackgroundMusic();
        });
        this.backgroundMusic.addEventListener('error', (e) => {
            console.error('[SoundManager] Error loading background music:', e);
        });
        console.log('[SoundManager] Constructor finished.');
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public startBackgroundMusic(): void {
        console.log('[SoundManager] Attempting to start background music...');
        if (this.backgroundMusic && !this.isMusicPlaying) {
            console.log('[SoundManager] Background music exists and not playing. Setting currentTime=0 and calling play().');
            this.backgroundMusic.currentTime = 0;
            const playPromise = this.backgroundMusic.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('[SoundManager] Background music started playing successfully.');
                    this.isMusicPlaying = true;
                }).catch(error => {
                    console.warn('[SoundManager] Failed to play background music:', error);
                    // Attempt to play again after a short delay or user interaction might be needed
                });
            } else {
                console.warn('[SoundManager] Background music play() did not return a promise.');
            }
        } else if (!this.backgroundMusic) {
            console.warn('[SoundManager] Background music object not available.');
        } else {
            console.log('[SoundManager] Background music already playing or request ignored.');
        }
    }

    public stopBackgroundMusic(): void {
        if (this.backgroundMusic && this.isMusicPlaying) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
            this.isMusicPlaying = false;
        }
    }

    public setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        console.log(`[SoundManager] Master volume set to: ${this.volume}`);
        
        // Update background music volume
        if (this.backgroundMusic) {
            this.backgroundMusic.volume = this.volume * 0.7;
            console.log(`[SoundManager] Background music volume updated via setVolume: ${this.backgroundMusic.volume.toFixed(2)}`);
        }
    }

    public cleanup(): void {
        this.stopBackgroundMusic();
        if (this.backgroundMusic) {
            this.backgroundMusic.src = '';
        }
    }
} 