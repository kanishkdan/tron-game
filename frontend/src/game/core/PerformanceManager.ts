import * as THREE from 'three';

/**
 * Manages game performance by dynamically adjusting resolution scaling
 * to maintain target FPS regardless of screen size
 */
export class PerformanceManager {
    private static instance: PerformanceManager;
    private lastFpsTime = 0;
    private frameCount = 0;
    private currentFps = 60;
    private targetFps = 60;
    private resolutionScale = 1.0;
    private readonly MIN_RESOLUTION_SCALE = 0.3;
    private fpsHistory: number[] = [];
    private readonly FPS_HISTORY_SIZE = 20; // Increase history size for more stability
    private isEnabled = true;
    private lastResolutionChangeTime = 0;
    private readonly MIN_CHANGE_INTERVAL = 2000; // Minimum 2 seconds between resolution changes
    private readonly TARGET_MIN_FPS = 45; // Never go below this FPS

    private constructor() {
        // Initialize resolution based on device size
        this.initializeResolutionScale();
        
        // Initialize FPS history with target values
        for (let i = 0; i < this.FPS_HISTORY_SIZE; i++) {
            this.fpsHistory.push(this.targetFps);
        }

        // Apply initial resolution scale to renderer
        if (window.gameRenderer) {
            this.applyResolutionScale();
        } else {
            // If renderer not available yet, wait and try again
            setTimeout(() => this.applyResolutionScale(), 1000);
        }

        // Listen for window resize events to reapply resolution
        window.addEventListener('resize', () => this.applyResolutionScale());
    }
    
    /**
     * Initialize resolution scale based on device capabilities
     */
    private initializeResolutionScale(): void {
        // Check if we're on a mobile/low-tier device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isLowEndDevice = isMobile || window.innerWidth < 768;
        
        // Start at 75% for big devices, 30% for small/mid/low tier
        this.resolutionScale = isLowEndDevice ? 0.3 : 0.75;
        
        console.log(`Initializing resolution scale at ${(this.resolutionScale * 100).toFixed(0)}% based on device type`);
    }

    public static getInstance(): PerformanceManager {
        if (!PerformanceManager.instance) {
            PerformanceManager.instance = new PerformanceManager();
        }
        return PerformanceManager.instance;
    }

    /**
     * Call this method on each frame to update FPS tracking and adjust resolution
     */
    public update(): void {
        if (!this.isEnabled) return;

        const now = performance.now();
        this.frameCount++;
        
        // Calculate FPS every second
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
            
            // Add to history and remove oldest entry
            this.fpsHistory.push(this.currentFps);
            if (this.fpsHistory.length > this.FPS_HISTORY_SIZE) {
                this.fpsHistory.shift();
            }
            
            // Only consider resolution changes after MIN_CHANGE_INTERVAL to prevent flickering
            if (now - this.lastResolutionChangeTime < this.MIN_CHANGE_INTERVAL) {
                return;
            }
            
            // Calculate average FPS from history to avoid rapid fluctuations
            // Use the last 10 samples only, but keep a longer history for stability
            const recentFps = this.fpsHistory.slice(-10);
            const avgFps = recentFps.reduce((sum, fps) => sum + fps, 0) / recentFps.length;
            
            // If FPS is below target minimum, reduce resolution to improve performance
            if (avgFps < this.TARGET_MIN_FPS) {
                // Reduce resolution more aggressively when FPS is very low
                const reduction = avgFps < 30 ? 0.9 : 0.95;
                const newScale = Math.max(this.resolutionScale * reduction, this.MIN_RESOLUTION_SCALE);
                
                // Only apply if the change is significant (>1%)
                if (Math.abs(newScale - this.resolutionScale) > 0.01) {
                    this.resolutionScale = newScale;
                    this.applyResolutionScale();
                    this.lastResolutionChangeTime = now;
                    console.log(`FPS: ${avgFps.toFixed(1)} - Reducing resolution to ${(this.resolutionScale * 100).toFixed(0)}%`);
                }
            } 
            // If FPS is above target and we have headroom, gradually increase resolution
            else if (avgFps > this.TARGET_MIN_FPS && this.resolutionScale < 1.0) {
                // Increase by 5% at a time as long as we maintain good FPS
                const newScale = Math.min(this.resolutionScale + 0.05, 1.0);
                
                this.resolutionScale = newScale;
                this.applyResolutionScale();
                this.lastResolutionChangeTime = now;
                console.log(`FPS: ${avgFps.toFixed(1)} - Increasing resolution to ${(this.resolutionScale * 100).toFixed(0)}%`);
            }
        }
    }
    
    /**
     * Applies the current resolution scale to the renderer
     */
    private applyResolutionScale(): void {
        if (!window.gameRenderer) return;
        
        const renderer = window.gameRenderer;
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Apply scaled pixel ratio
        renderer.setPixelRatio(pixelRatio * this.resolutionScale);
        
        // Update renderer size to match current window size with scaling
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height, false); // Don't update CSS size
    }

    /**
     * Set target FPS (default is 60)
     */
    public setTargetFps(fps: number): void {
        this.targetFps = fps;
    }

    /**
     * Enable or disable dynamic resolution scaling
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        
        // If enabling, reset history
        if (enabled) {
            this.fpsHistory = [];
            for (let i = 0; i < this.FPS_HISTORY_SIZE; i++) {
                this.fpsHistory.push(this.targetFps);
            }
        } else {
            // If disabling, reset to full resolution
            this.resolutionScale = 1.0;
            this.applyResolutionScale();
        }
    }

    /**
     * Get current FPS
     */
    public getCurrentFps(): number {
        return this.currentFps;
    }

    /**
     * Get current resolution scale (1.0 = 100%)
     */
    public getResolutionScale(): number {
        return this.resolutionScale;
    }

    /**
     * Force a specific resolution scale
     */
    public setResolutionScale(scale: number): void {
        this.resolutionScale = Math.max(this.MIN_RESOLUTION_SCALE, Math.min(1.0, scale));
        this.applyResolutionScale();
        this.lastResolutionChangeTime = performance.now();
    }
} 