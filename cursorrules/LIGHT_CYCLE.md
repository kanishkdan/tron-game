# LightCycle Component Documentation

## Overview
The LightCycle component is the core vehicle system in Girgaya, implementing the iconic light cycle from Tron. It handles physics, movement, trail generation, and visual effects.

## Core Features

### 1. Physics System
```typescript
private body: CANNON.Body;
private readonly MAX_SPEED = 50;
private readonly MIN_SPEED = 30;
private readonly ACCELERATION = 15;
private readonly DECELERATION = 20;
```
- Custom physics body with optimized dimensions
- Smooth acceleration and deceleration
- Grid-based movement constraints
- Ground contact management
- Collision detection and response

### 2. Movement System
```typescript
private readonly GRID_SIZE = 2;
private readonly TURN_SPEED = 2.0;
private readonly BANK_ANGLE = 0.3;
```
- Grid-based movement for precise control
- Smooth turning with banking effects
- Speed-dependent camera adjustments
- Trail generation system
- Boundary collision detection

### 3. Visual Effects
```typescript
private lightTrail: THREE.Mesh[];
private trailMaterial: THREE.MeshStandardMaterial;
private rearLight: THREE.PointLight;
```
- Dynamic light trail generation
- Glowing effects and materials
- Headlight and taillight system
- Particle effects for collisions
- Material properties for Tron-style visuals

## Key Methods

### 1. Movement Control
```typescript
move(direction: 'left' | 'right' | null) {
    if (direction === 'left') {
        this.turnDirection = 1;
    } else if (direction === 'right') {
        this.turnDirection = -1;
    } else {
        this.turnDirection = 0;
    }
}
```
- Handles turn input
- Updates turn direction
- Manages smooth transitions
- Controls banking effects

### 2. Trail Generation
```typescript
private updateLightTrail() {
    // Calculate current position
    const currentPosition = this.mesh.position.clone();
    currentPosition.y = 0.5;
    
    // Create trail segment
    const trailSegment = new THREE.Mesh(
        this.trailGeometry,
        this.trailMaterial
    );
    
    // Position and add to scene
    trailSegment.position.copy(midpoint);
    this.scene.add(trailSegment);
}
```
- Generates light trail segments
- Manages trail length and cleanup
- Optimizes trail rendering
- Handles trail positioning

### 3. Physics Update
```typescript
update(deltaTime: number) {
    // Update speed
    this.currentSpeed = Math.min(
        this.currentSpeed + this.ACCELERATION * deltaTime,
        this.MAX_SPEED
    );
    
    // Update position and rotation
    this.mesh.position.copy(this.body.position as any);
    this.mesh.rotation.y = this.currentRotation;
    this.mesh.rotation.z = this.currentBankAngle;
}
```
- Updates physics state
- Handles movement and rotation
- Manages collision response
- Updates visual representation

## Technical Details

### Physics Properties
- Mass: 1
- Linear Damping: 0.2
- Angular Damping: 0.5
- Friction: 0.3
- Restitution: 0.1

### Movement Constraints
- Grid Size: 2 units
- Max Speed: 50 units/s
- Min Speed: 30 units/s
- Turn Speed: 2.0 rad/s
- Bank Angle: 0.3 rad

### Visual Properties
- Trail Height: 0.5 units
- Trail Width: 0.2 units
- Trail Opacity: 0.9
- Light Intensity: 2.0
- Material Properties:
  - Metalness: 0.8
  - Roughness: 0.2
  - Emissive: 0x0fbef2
  - Emissive Intensity: 0.5

## Performance Considerations
- Optimized trail generation
- Efficient physics calculations
- Memory management for trails
- Collision optimization
- Visual effect performance

## Future Improvements
- Enhanced trail effects
- Better collision response
- Improved banking system
- Additional visual effects
- Performance optimizations 