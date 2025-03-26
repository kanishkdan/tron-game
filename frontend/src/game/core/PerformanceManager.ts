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
    private targetFps = 50;
    private resolutionScale = 1.0;
    private readonly MIN_RESOLUTION_SCALE = 0.3;
    private fpsHistory: number[] = [];
    private readonly FPS_HISTORY_SIZE = 20;
    private isEnabled = true;
    private lastResolutionChangeTime = 0;
    private readonly MIN_CHANGE_INTERVAL = 5000;
    private isOptimalState = false; // Track if we've achieved optimal state (50+ FPS at 100% resolution)

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
        this.resolutionScale = isLowEndDevice ? 0.3 : 0.90;
        
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
            
            // Calculate average FPS from recent history
            const recentFps = this.fpsHistory.slice(-10);
            const avgFps = recentFps.reduce((sum, fps) => sum + fps, 0) / recentFps.length;

            // If we're in optimal state (50+ FPS at 100% resolution), only check if FPS drops
            if (this.isOptimalState) {
                if (avgFps < this.targetFps) {
                    this.isOptimalState = false;
                    console.log(`FPS dropped below target (${avgFps.toFixed(1)}), resuming resolution management`);
                }
                return;
            }
            
            // Only consider resolution changes after MIN_CHANGE_INTERVAL to prevent flickering
            if (now - this.lastResolutionChangeTime < this.MIN_CHANGE_INTERVAL) {
                return;
            }
            
            // If FPS is below target, reduce resolution
            if (avgFps < this.targetFps) {
                const reduction = avgFps < 30 ? 0.9 : 0.95;
                const newScale = Math.max(this.resolutionScale * reduction, this.MIN_RESOLUTION_SCALE);
                
                if (Math.abs(newScale - this.resolutionScale) > 0.01) {
                    this.resolutionScale = newScale;
                    this.applyResolutionScale();
                    this.lastResolutionChangeTime = now;
                    console.log(`FPS: ${avgFps.toFixed(1)} - Reducing resolution to ${(this.resolutionScale * 100).toFixed(0)}%`);
                }
            } 
            // If FPS is above target, gradually increase resolution
            else if (avgFps > this.targetFps && this.resolutionScale < 1.0) {
                const newScale = Math.min(this.resolutionScale + 0.05, 1.0);
                
                this.resolutionScale = newScale;
                this.applyResolutionScale();
                this.lastResolutionChangeTime = now;
                console.log(`FPS: ${avgFps.toFixed(1)} - Increasing resolution to ${(this.resolutionScale * 100).toFixed(0)}%`);

                // Check if we've reached optimal state (50+ FPS at 100% resolution)
                if (this.resolutionScale >= 1.0) {
                    this.isOptimalState = true;
                    console.log(`Achieved optimal state: ${avgFps.toFixed(1)} FPS at 100% resolution`);
                }
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