import * as THREE from 'three';
import { LightCycle } from './LightCycle';

export class CameraController {
    private camera: THREE.PerspectiveCamera;
    private target: LightCycle;
    private readonly FOLLOW_DISTANCE = 25;
    private readonly HEIGHT_OFFSET = 8;
    private readonly LOOK_AHEAD = 1;
    private readonly SMOOTHING = 0.08;
    private readonly TILT_STRENGTH = 0.15;
    private readonly MIN_HEIGHT = 6;
    private readonly MAX_HEIGHT = 15;
    private readonly NATURAL_HEIGHT = 10;
    private readonly NATURAL_FOV = 75;
    private readonly TURN_HEIGHT_BOOST = 0;
    private readonly RETURN_SPEED = 0.10;
    private readonly MAX_LATERAL_OFFSET = 2.5;
    private currentPosition = new THREE.Vector3();
    private currentLookAt = new THREE.Vector3();
    private idealOffset = new THREE.Vector3();
    private idealLookAt = new THREE.Vector3();
    private lastUpdateTime = 0;
    private readonly CAMERA_LAG = 0.2;
    private isReturningToNatural = false;
    private returnProgress = 0;
    private lastTurnDirection = 0;

    constructor(camera: THREE.PerspectiveCamera, target: LightCycle) {
        this.camera = camera;
        this.target = target;
        
        const targetPos = target.getPosition();
        const targetRot = target.getRotation();
        
        this.calculateIdealCameraPositions(targetPos, 0, target.getCurrentSpeed());
        
        this.currentPosition.copy(this.idealOffset);
        this.currentLookAt.copy(this.idealLookAt);
        
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    private calculateIdealCameraPositions(targetPos: THREE.Vector3, targetRot: number, speed: number) {
        const turnDirection = this.target.getTurnDirection();
        
        if (this.lastTurnDirection !== 0 && turnDirection === 0) {
            this.isReturningToNatural = true;
            this.returnProgress = 0;
        }
        this.lastTurnDirection = turnDirection;

        const speedFactor = Math.min(speed / 50, 1);
        let dynamicHeight = THREE.MathUtils.lerp(
            this.MIN_HEIGHT,
            this.MAX_HEIGHT,
            speedFactor * 0.3
        );

        if (turnDirection !== 0) {
            dynamicHeight += this.TURN_HEIGHT_BOOST * Math.abs(turnDirection);
            this.isReturningToNatural = false;
        }

        if (this.isReturningToNatural) {
            this.returnProgress = Math.min(this.returnProgress + this.RETURN_SPEED, 1);
            dynamicHeight = THREE.MathUtils.lerp(
                dynamicHeight,
                this.NATURAL_HEIGHT,
                this.returnProgress
            );
        }

        const lateralOffset = Math.min(
            Math.abs(turnDirection * this.MAX_LATERAL_OFFSET),
            this.MAX_LATERAL_OFFSET
        ) * Math.sign(turnDirection);

        const distanceFactor = 1 + speedFactor * 0.2;
        this.idealOffset.set(
            targetPos.x - Math.sin(targetRot) * (this.FOLLOW_DISTANCE * distanceFactor) + lateralOffset,
            targetPos.y + dynamicHeight,
            targetPos.z - Math.cos(targetRot) * (this.FOLLOW_DISTANCE * distanceFactor)
        );

        const lookAheadDistance = this.LOOK_AHEAD * (1 + speedFactor * 0.2);
        this.idealLookAt.set(
            targetPos.x + Math.sin(-targetRot) * lookAheadDistance * 0.5,
            targetPos.y + this.HEIGHT_OFFSET * 0.3,
            targetPos.z + Math.cos(-targetRot) * lookAheadDistance * 0.5
        );
    }

    update(deltaTime: number) {
        const currentTime = performance.now();
        const timeDiff = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        const targetPos = this.target.getPosition();
        const targetRot = this.target.getRotation();
        const targetSpeed = this.target.getCurrentSpeed();
        const turnDirection = this.target.getTurnDirection();

        this.calculateIdealCameraPositions(targetPos, targetRot, targetSpeed);

        let smoothingFactor = Math.min(timeDiff * this.CAMERA_LAG, 1);
        if (this.isReturningToNatural) {
            smoothingFactor *= 0.8;
        } else if (turnDirection !== 0) {
            smoothingFactor *= 0.9;
        }

        this.currentPosition.lerp(this.idealOffset, smoothingFactor);
        this.currentLookAt.lerp(this.idealLookAt, smoothingFactor);

        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);

        const tiltSmoothness = Math.min(0.08 * deltaTime, 1);
        
        const targetTilt = turnDirection * this.TILT_STRENGTH;
        this.camera.rotation.z = THREE.MathUtils.lerp(
            this.camera.rotation.z,
            targetTilt,
            tiltSmoothness
        );

        const speedFOVBoost = (targetSpeed / 60) * 4;
        const turnFOVBoost = Math.abs(turnDirection) * 2;
        const targetFOV = this.NATURAL_FOV + speedFOVBoost + turnFOVBoost;
        
        this.camera.fov = THREE.MathUtils.lerp(
            this.camera.fov,
            targetFOV,
            0.08
        );
        this.camera.updateProjectionMatrix();
    }
} 

// export class CameraController {
//     private camera: THREE.PerspectiveCamera;
//     private target: LightCycle;
//     private readonly FOLLOW_DISTANCE = 25;
//     private readonly HEIGHT_OFFSET = 12;
//     private readonly LOOK_AHEAD = 15;
//     private readonly SMOOTHING = 0.08;
//     private readonly TILT_STRENGTH = 0.15;
//     private readonly MIN_HEIGHT = 8;
//     private readonly MAX_HEIGHT = 20;
//     private readonly NATURAL_HEIGHT = 12;
//     private readonly NATURAL_FOV = 75;
//     private readonly TURN_HEIGHT_BOOST = 3;
//     private readonly RETURN_SPEED = 0.05;
//     private readonly MAX_LATERAL_OFFSET = 3;
//     private currentPosition = new THREE.Vector3();
//     private currentLookAt = new THREE.Vector3();
//     private idealOffset = new THREE.Vector3();
//     private idealLookAt = new THREE.Vector3();
//     private lastUpdateTime = 0;
//     private readonly CAMERA_LAG = 0.15;
//     private isReturningToNatural = false;
//     private returnProgress = 0;
//     private lastTurnDirection = 0;

//     constructor(camera: THREE.PerspectiveCamera, target: LightCycle) {
//         this.camera = camera;
//         this.target = target;
        
//         // Set initial camera position for elevated behind-the-bike view
//         const targetPos = target.getPosition();
//         const targetRot = target.getRotation();
        
//         // Calculate initial positions for elevated start
//         this.calculateIdealCameraPositions(targetPos, 0, target.getCurrentSpeed());
        
//         this.currentPosition.copy(this.idealOffset);
//         this.currentLookAt.copy(this.idealLookAt);
        
//         // Position camera behind bike, looking forward
//         this.camera.position.copy(this.currentPosition);
//         this.camera.lookAt(this.currentLookAt);
//     }

//     private calculateIdealCameraPositions(targetPos: THREE.Vector3, targetRot: number, speed: number) {
//         const turnDirection = this.target.getTurnDirection();
        
//         // Start return to natural position when turn ends
//         if (this.lastTurnDirection !== 0 && turnDirection === 0) {
//             this.isReturningToNatural = true;
//             this.returnProgress = 0;
//         }
//         this.lastTurnDirection = turnDirection;

//         // Calculate dynamic height based on speed and turn state
//         const speedFactor = Math.min(speed / 50, 1);
//         let dynamicHeight = THREE.MathUtils.lerp(
//             this.MIN_HEIGHT,
//             this.MAX_HEIGHT,
//             speedFactor * 0.5
//         );

//         // Add subtle height boost during turns
//         if (turnDirection !== 0) {
//             dynamicHeight += this.TURN_HEIGHT_BOOST * Math.abs(turnDirection);
//             this.isReturningToNatural = false;
//         }

//         // Handle return to natural position
//         if (this.isReturningToNatural) {
//             this.returnProgress = Math.min(this.returnProgress + this.RETURN_SPEED, 1);
//             dynamicHeight = THREE.MathUtils.lerp(
//                 dynamicHeight,
//                 this.NATURAL_HEIGHT,
//                 this.returnProgress
//             );
//         }

//         // Calculate camera offset with limited lateral movement
//         const lateralOffset = Math.min(
//             Math.abs(turnDirection * this.MAX_LATERAL_OFFSET),
//             this.MAX_LATERAL_OFFSET
//         ) * Math.sign(turnDirection);

//         // Position camera behind bike with subtle offset during turns
//         this.idealOffset.set(
//             targetPos.x - Math.sin(targetRot) * this.FOLLOW_DISTANCE + lateralOffset,
//             targetPos.y + dynamicHeight,
//             targetPos.z - Math.cos(targetRot) * this.FOLLOW_DISTANCE
//         );

//         // Keep look-at point closer to bike for better centering
//         const lookAheadDistance = this.LOOK_AHEAD * (1 + speedFactor * 0.3);
//         const bikeOffset = 2;
//         this.idealLookAt.set(
//             targetPos.x + Math.sin(-targetRot) * lookAheadDistance * 0.7,
//             targetPos.y + bikeOffset,
//             targetPos.z + Math.cos(-targetRot) * lookAheadDistance * 0.7
//         );
//     }

//     update(deltaTime: number) {
//         const currentTime = performance.now();
//         const timeDiff = currentTime - this.lastUpdateTime;
//         this.lastUpdateTime = currentTime;

//         const targetPos = this.target.getPosition();
//         const targetRot = this.target.getRotation();
//         const targetSpeed = this.target.getCurrentSpeed();
//         const turnDirection = this.target.getTurnDirection();

//         // Update ideal camera positions
//         this.calculateIdealCameraPositions(targetPos, targetRot, targetSpeed);

//         // Calculate smoothing factor based on turn state
//         let smoothingFactor = Math.min(timeDiff * this.CAMERA_LAG, 1);
//         if (this.isReturningToNatural) {
//             // Quicker return to natural position
//             smoothingFactor *= 0.8;
//         } else if (turnDirection !== 0) {
//             // Moderate response during turns
//             smoothingFactor *= 1.2;
//         }

//         // Smoothly interpolate current position and lookAt
//         this.currentPosition.lerp(this.idealOffset, smoothingFactor);
//         this.currentLookAt.lerp(this.idealLookAt, smoothingFactor * 1.2);

//         // Update camera position and look-at
//         this.camera.position.copy(this.currentPosition);
//         this.camera.lookAt(this.currentLookAt);

//         // Add subtle camera tilt during turns
//         const targetTilt = turnDirection * this.TILT_STRENGTH;
//         const tiltSmoothness = this.isReturningToNatural ? 0.08 : 0.12;
//         this.camera.rotation.z = THREE.MathUtils.lerp(
//             this.camera.rotation.z,
//             targetTilt,
//             tiltSmoothness
//         );

//         // Adjust FOV based on speed and turn state with reduced effect
//         const speedFOVBoost = (targetSpeed / 60) * 5;
//         const turnFOVBoost = Math.abs(turnDirection) * 3;
//         const targetFOV = this.NATURAL_FOV + speedFOVBoost + turnFOVBoost;
        
//         this.camera.fov = THREE.MathUtils.lerp(
//             this.camera.fov,
//             targetFOV,
//             this.isReturningToNatural ? 0.08 : 0.12
//         );
//         this.camera.updateProjectionMatrix();
//     }
// } 