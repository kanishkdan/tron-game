import * as THREE from 'three';

/**
 * Manages game performance by dynamically adjusting resolution scaling
 * to maintain target FPS regardless of screen size.
 * Uses localStorage to remember stable settings between sessions.
 */
export class PerformanceManager {
    private static instance: PerformanceManager;
    private lastFpsTime = 0;
    private frameCount = 0;
    private currentFps = 60;
    private targetFps = 50;
    private resolutionScale = 1.0;
    private readonly MIN_RESOLUTION_SCALE = 0.3;
    private fpsHistory: number[] = [];
    private readonly FPS_HISTORY_SIZE = 20;
    private isEnabled = true;
    private lastResolutionChangeTime = 0;
    private readonly MIN_CHANGE_INTERVAL = 3000; // Slightly reduced interval
    private readonly STABILITY_THRESHOLD = 0.01; // Minimum change to apply
    private readonly SMOOTHING_FACTOR = 0.1; // How quickly to move towards ideal scale (0 to 1)
    
    // localStorage persistence
    private readonly STORAGE_KEY = 'tron_stableResolutionScale';
    private lastScaleUpdateTime = 0;
    private readonly STABLE_TIME_MS = 10000; // Time (ms) scale needs to be stable before saving

    private constructor() {
        this.initializeResolutionScale();
        
        for (let i = 0; i < this.FPS_HISTORY_SIZE; i++) {
            this.fpsHistory.push(this.targetFps);
        }

        if (window.gameRenderer) {
            this.applyResolutionScale();
        } else {
            setTimeout(() => this.applyResolutionScale(), 1000);
        }

        window.addEventListener('resize', () => this.applyResolutionScale());
    }
    
    /**
     * Initialize resolution scale based on stored value or device capabilities.
     */
    private initializeResolutionScale(): void {
        let initialScale = this.loadStableScale();

        if (initialScale === null) {
            // Fallback to device type if no stored scale
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const isSmallScreen = window.innerWidth < 800 || window.innerHeight < 600;
            const isLowEndDevice = isMobile || isSmallScreen;
            
            initialScale = isLowEndDevice ? 0.60 : 0.80; // Start lower for low-end, higher for high-end
            console.log(`No stored scale found. Initializing resolution scale at ${(initialScale * 100).toFixed(0)}% based on device type.`);
        } else {
            console.log(`Loaded stable resolution scale from previous session: ${(initialScale * 100).toFixed(0)}%`);
        }
        
        this.resolutionScale = initialScale;
        this.lastScaleUpdateTime = performance.now(); // Initialize stability timer
    }

    private loadStableScale(): number | null {
        try {
            const storedValue = localStorage.getItem(this.STORAGE_KEY);
            if (storedValue) {
                const scale = parseFloat(storedValue);
                if (!isNaN(scale) && scale >= this.MIN_RESOLUTION_SCALE && scale <= 1.0) {
                    return scale;
                }
            }
        } catch (error) {
            console.warn('Could not read stable resolution scale from localStorage:', error);
        }
        return null;
    }

    private saveStableScale(scale: number): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, scale.toFixed(2));
            // console.log(`Saved stable resolution scale: ${(scale * 100).toFixed(0)}%`);
        } catch (error) {
            console.warn('Could not save stable resolution scale to localStorage:', error);
        }
    }

    public static getInstance(): PerformanceManager {
        if (!PerformanceManager.instance) {
            PerformanceManager.instance = new PerformanceManager();
        }
        return PerformanceManager.instance;
    }

    /**
     * Call this method on each frame to update FPS tracking and adjust resolution.
     */
    public update(): void {
        if (!this.isEnabled) return;

        const now = performance.now();
        this.frameCount++;
        
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
            
            this.fpsHistory.push(this.currentFps);
            if (this.fpsHistory.length > this.FPS_HISTORY_SIZE) {
                this.fpsHistory.shift();
            }
            
            const recentFps = this.fpsHistory.slice(-10); // Average over last 10 seconds
            const avgFps = recentFps.reduce((sum, fps) => sum + fps, 0) / recentFps.length;

            if (now - this.lastResolutionChangeTime < this.MIN_CHANGE_INTERVAL) {
                // Check for stability even if not changing scale yet
                 if (now - this.lastScaleUpdateTime > this.STABLE_TIME_MS) {
                    this.saveStableScale(this.resolutionScale);
                    this.lastScaleUpdateTime = now; // Reset timer after saving
                }
                return; // Don't adjust scale too frequently
            }
            
            // Calculate the ideal scale based on current performance vs target
            // Add a small buffer to targetFps to prevent unnecessary scaling when close
            const effectiveTargetFps = this.targetFps; // Example: Add 2 FPS buffer
            let idealScale = this.resolutionScale * (avgFps / effectiveTargetFps);

            // Clamp ideal scale to bounds
            idealScale = Math.max(this.MIN_RESOLUTION_SCALE, Math.min(1.0, idealScale));

            // Smoothly interpolate towards the ideal scale
            let newScale = this.resolutionScale + (idealScale - this.resolutionScale) * this.SMOOTHING_FACTOR;
            
            // Clamp the final new scale as well
            newScale = Math.max(this.MIN_RESOLUTION_SCALE, Math.min(1.0, newScale));

            const scaleChange = newScale - this.resolutionScale;

            // Apply the change only if it's significant enough
            if (Math.abs(scaleChange) > this.STABILITY_THRESHOLD) {
                const direction = scaleChange > 0 ? 'Increasing' : 'Reducing';
                this.resolutionScale = newScale;
                this.applyResolutionScale();
                this.lastResolutionChangeTime = now;
                this.lastScaleUpdateTime = now; // Reset stability timer on change
                console.log(`FPS: ${avgFps.toFixed(1)} -> ${direction} resolution to ${(this.resolutionScale * 100).toFixed(0)}% (Ideal: ${(idealScale * 100).toFixed(0)}%)`);
            } else {
                 // Scale is considered stable, check if we should save it
                if (now - this.lastScaleUpdateTime > this.STABLE_TIME_MS) {
                    this.saveStableScale(this.resolutionScale);
                    this.lastScaleUpdateTime = now; // Reset timer after saving
                }
            }
        }
    }
    
    /**
     * Applies the current resolution scale to the renderer.
     */
    private applyResolutionScale(): void {
        if (!window.gameRenderer) return;
        
        const renderer = window.gameRenderer;
        // Ensure pixelRatio is at least 1, even if device reports lower
        const pixelRatio = Math.max(1, window.devicePixelRatio || 1); 
        
        renderer.setPixelRatio(pixelRatio * this.resolutionScale);
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        // Setting updateStyle to false prevents layout shifts if CSS size is different
        renderer.setSize(width, height, false); 
    }

    /**
     * Set target FPS (default is 50).
     */
    public setTargetFps(fps: number): void {
        this.targetFps = Math.max(10, fps); // Ensure target is reasonable
        // Reset history when target changes
        this.fpsHistory = [];
         for (let i = 0; i < this.FPS_HISTORY_SIZE; i++) {
            this.fpsHistory.push(this.targetFps);
        }
        console.log(`Target FPS set to: ${this.targetFps}`);
    }

    /**
     * Enable or disable dynamic resolution scaling.
     */
    public setEnabled(enabled: boolean): void {
        const changed = this.isEnabled !== enabled;
        this.isEnabled = enabled;
        
        if (changed) {
            if (enabled) {
                 console.log('Dynamic resolution enabled.');
                // Reset history and potentially re-initialize scale? 
                // Or just let it adapt from current state. Let's just reset history.
                 this.fpsHistory = [];
                 for (let i = 0; i < this.FPS_HISTORY_SIZE; i++) {
                    this.fpsHistory.push(this.targetFps);
                 }
                 this.lastScaleUpdateTime = performance.now(); // Reset stability timer
            } else {
                console.log('Dynamic resolution disabled. Setting resolution to 100%.');
                // If disabling, reset to full resolution
                this.resolutionScale = 1.0;
                this.applyResolutionScale();
                 // Optionally clear stored value when disabled? Or keep it for next time? Let's keep it.
            }
        }
    }

    /**
     * Get current average FPS (based on recent history).
     */
    public getAverageFps(): number {
         if (this.fpsHistory.length === 0) return 0;
         const recentFps = this.fpsHistory.slice(-10);
         return recentFps.reduce((sum, fps) => sum + fps, 0) / recentFps.length;
    }
    
    /** Get instantaneous FPS */
    public getCurrentFps(): number {
        return this.currentFps;
    }

    /**
     * Get current resolution scale (1.0 = 100%).
     */
    public getResolutionScale(): number {
        return this.resolutionScale;
    }

    /**
     * Force a specific resolution scale, bypassing dynamic adjustments temporarily.
     */
    public setResolutionScale(scale: number): void {
        const newScale = Math.max(this.MIN_RESOLUTION_SCALE, Math.min(1.0, scale));
        if (Math.abs(newScale - this.resolutionScale) > 0.001) { // Avoid tiny changes
            this.resolutionScale = newScale;
            this.applyResolutionScale();
            this.lastResolutionChangeTime = performance.now();
             this.lastScaleUpdateTime = performance.now(); // Reset stability timer
             console.log(`Resolution scale forced to ${(this.resolutionScale * 100).toFixed(0)}%`);
             // Consider if forcing should disable automatic adjustments temporarily or permanently
             // For now, it just sets the value and lets the update loop take over again.
        }
    }

     /**
     * Clear the stored stable resolution scale from localStorage.
     */
    public clearStoredScale(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('Cleared stored stable resolution scale.');
        } catch (error) {
            console.warn('Could not clear stored scale from localStorage:', error);
        }
    }
} 