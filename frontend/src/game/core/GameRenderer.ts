import * as THREE from 'three';

export class GameRenderer {
    private renderer: THREE.WebGLRenderer;
    private performanceMode: 'high' | 'medium' | 'low' = 'high';
    private lastPerformanceCheck = 0;
    private fpsArray: number[] = [];
    private readonly FPS_SAMPLE_SIZE = 60;
    private pixelRatio = window.devicePixelRatio;

    constructor(private canvas: HTMLCanvasElement) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });

        // Initialize with optimal settings
        this.initializeRenderer();
        
        // Start performance monitoring
        this.monitorPerformance();
    }

    private initializeRenderer() {
        // Set initial pixel ratio based on device
        this.pixelRatio = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(this.pixelRatio);

        // Enable performance-enhancing features
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set performance mode based on device capabilities
        if (this.isLowEndDevice()) {
            this.setPerformanceMode('low');
        }
    }

    private isLowEndDevice(): boolean {
        const gpu = (navigator as any).gpu;
        if (gpu) {
            return false; // WebGPU support indicates a capable device
        }
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }

    private monitorPerformance() {
        let lastTime = performance.now();
        const checkPerformance = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;
            const fps = 1000 / deltaTime;
            
            this.fpsArray.push(fps);
            if (this.fpsArray.length > this.FPS_SAMPLE_SIZE) {
                this.fpsArray.shift();
            }

            // Check performance every second
            if (currentTime - this.lastPerformanceCheck > 1000) {
                this.adjustPerformance();
                this.lastPerformanceCheck = currentTime;
            }

            lastTime = currentTime;
            requestAnimationFrame(checkPerformance);
        };

        requestAnimationFrame(checkPerformance);
    }

    private adjustPerformance() {
        const avgFps = this.fpsArray.reduce((a, b) => a + b, 0) / this.fpsArray.length;
        
        if (avgFps < 30 && this.performanceMode !== 'low') {
            this.setPerformanceMode('low');
        } else if (avgFps < 45 && this.performanceMode === 'high') {
            this.setPerformanceMode('medium');
        } else if (avgFps > 55 && this.performanceMode === 'low') {
            this.setPerformanceMode('medium');
        } else if (avgFps > 58 && this.performanceMode === 'medium') {
            this.setPerformanceMode('high');
        }
    }

    private setPerformanceMode(mode: 'high' | 'medium' | 'low') {
        this.performanceMode = mode;
        
        switch (mode) {
            case 'low':
                this.renderer.setPixelRatio(1);
                this.renderer.shadowMap.enabled = false;
                this.renderer.setSize(
                    this.canvas.clientWidth * 0.75,
                    this.canvas.clientHeight * 0.75
                );
                break;
                
            case 'medium':
                this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFShadowMap;
                this.renderer.setSize(
                    this.canvas.clientWidth * 0.85,
                    this.canvas.clientHeight * 0.85
                );
                break;
                
            case 'high':
                this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.setSize(
                    this.canvas.clientWidth,
                    this.canvas.clientHeight
                );
                break;
        }
    }

    render(scene: THREE.Scene, camera: THREE.Camera) {
        this.renderer.render(scene, camera);
    }

    resize() {
        // Maintain performance-aware resize
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        const scale = this.performanceMode === 'low' ? 0.75 :
                     this.performanceMode === 'medium' ? 0.85 : 1;
                     
        this.renderer.setSize(width * scale, height * scale);
    }

    dispose() {
        this.renderer.dispose();
    }
} 