import * as THREE from 'three';
import { LightCycle } from './LightCycle';

export class CameraController {
    private camera: THREE.PerspectiveCamera;
    private target: LightCycle;
    private readonly FOLLOW_DISTANCE = 25;
    private readonly HEIGHT_OFFSET = 8;
    private readonly LOOK_AHEAD = 12;
    private readonly SMOOTHING = 0.05;
    private readonly TILT_STRENGTH = 0.15;
    private currentPosition = new THREE.Vector3();
    private currentLookAt = new THREE.Vector3();
    private idealOffset = new THREE.Vector3();
    private idealLookAt = new THREE.Vector3();

    constructor(camera: THREE.PerspectiveCamera, target: LightCycle) {
        this.camera = camera;
        this.target = target;
        
        // Set initial camera position for centered view
        const targetPos = target.getPosition();
        const targetRot = target.getRotation();
        
        // Calculate initial positions for centered start
        this.calculateIdealCameraPositions(targetPos, 0, target.getCurrentSpeed());
        
        this.currentPosition.copy(this.idealOffset);
        this.currentLookAt.copy(this.idealLookAt);
        
        // Position camera behind bike, looking forward
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    private calculateIdealCameraPositions(targetPos: THREE.Vector3, targetRot: number, speed: number) {
        // Calculate camera offset based on bike's position and rotation
        this.idealOffset.set(
            targetPos.x - Math.sin(targetRot) * this.FOLLOW_DISTANCE,
            targetPos.y + this.HEIGHT_OFFSET + (speed / 150) * 2,
            targetPos.z - Math.cos(targetRot) * this.FOLLOW_DISTANCE
        );

        // Calculate look-at point ahead of the bike
        this.idealLookAt.set(
            targetPos.x + Math.sin(-targetRot) * this.LOOK_AHEAD,
            targetPos.y + 1.5,
            targetPos.z + Math.cos(-targetRot) * this.LOOK_AHEAD
        );
    }

    update(deltaTime: number) {
        const targetPos = this.target.getPosition();
        const targetRot = this.target.getRotation();
        const targetSpeed = this.target.getCurrentSpeed();
        const turnDirection = this.target.getTurnDirection();

        // Update ideal camera positions
        this.calculateIdealCameraPositions(targetPos, targetRot, targetSpeed);

        // Smoothly interpolate current position and lookAt
        this.currentPosition.lerp(this.idealOffset, this.SMOOTHING);
        this.currentLookAt.lerp(this.idealLookAt, this.SMOOTHING);

        // Update camera position and look-at
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);

        // Add dynamic camera tilt during turns
        const targetTilt = turnDirection * this.TILT_STRENGTH;
        this.camera.rotation.z = THREE.MathUtils.lerp(
            this.camera.rotation.z,
            targetTilt,
            0.05
        );

        // Adjust FOV based on speed
        const baseFOV = 70;
        const targetFOV = baseFOV + (targetSpeed / 60) * 5;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.05);
        this.camera.updateProjectionMatrix();
    }
} 