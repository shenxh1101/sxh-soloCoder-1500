import * as THREE from 'three';
import { getCagePosition } from '../utils/dataGenerator';

export class Robot {
  public group: THREE.Group;
  public camera: THREE.PerspectiveCamera;
  private body: THREE.Mesh;
  private arm: THREE.Mesh;
  private cameraMount: THREE.Mesh;
  private feedParticles: THREE.Group;
  private isFeeding: boolean = false;
  private feedTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.feedParticles = new THREE.Group();
    
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.set(0, 0, 0.5);
    this.camera.lookAt(0, 0, -1);
    
    this.createRobot();
  }

  private createRobot(): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.7,
      roughness: 0.3,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
    });

    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.5);
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.castShadow = true;
    this.group.add(this.body);

    const topGeometry = new THREE.BoxGeometry(0.9, 0.15, 0.6);
    const top = new THREE.Mesh(topGeometry, bodyMaterial);
    top.position.y = 0.375;
    top.castShadow = true;
    this.group.add(top);

    const armGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    this.arm = new THREE.Mesh(armGeometry, accentMaterial);
    this.arm.position.set(0, 0.1, -0.35);
    this.arm.castShadow = true;
    this.group.add(this.arm);

    const nozzleGeometry = new THREE.ConeGeometry(0.08, 0.15, 8);
    const nozzle = new THREE.Mesh(nozzleGeometry, accentMaterial);
    nozzle.rotation.x = Math.PI;
    nozzle.position.set(0, -0.25, -0.35);
    this.group.add(nozzle);

    const cameraGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.18);
    const cameraMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.5,
      roughness: 0.5,
    });
    this.cameraMount = new THREE.Mesh(cameraGeometry, cameraMaterial);
    this.cameraMount.position.set(0, 0.35, -0.3);
    this.cameraMount.castShadow = true;
    this.group.add(this.cameraMount);

    const lensGeometry = new THREE.CircleGeometry(0.05, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.5,
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, 0.35, -0.39);
    this.group.add(lens);

    const wheelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.3,
      roughness: 0.7,
    });
    
    [[-0.35, -0.3, 0.2], [0.35, -0.3, 0.2], [-0.35, -0.3, -0.2], [0.35, -0.3, -0.2]].forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      this.group.add(wheel);
    });

    const lightGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
    });
    const statusLight = new THREE.Mesh(lightGeometry, lightMaterial);
    statusLight.position.set(0.3, 0.4, 0);
    this.group.add(statusLight);

    this.group.add(this.feedParticles);
  }

  public updatePosition(x: number, y: number, z: number, time: number): void {
    this.group.position.set(x, y, z);
    
    const hoverOffset = Math.sin(time * 0.003) * 0.02;
    this.group.position.y += hoverOffset;
  }

  public startFeeding(): void {
    this.isFeeding = true;
    this.feedTime = 0;
    this.createFeedParticles();
  }

  public stopFeeding(): void {
    this.isFeeding = false;
    this.clearFeedParticles();
  }

  private createFeedParticles(): void {
    const particleGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
    });

    for (let i = 0; i < 30; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
      particle.position.set(
        (Math.random() - 0.5) * 0.1,
        -0.3,
        -0.35 + Math.random() * 0.1
      );
      particle.userData = {
        velocity: {
          x: (Math.random() - 0.5) * 0.02,
          y: -0.03 - Math.random() * 0.02,
          z: -0.01 - Math.random() * 0.02,
        },
        life: 1,
      };
      this.feedParticles.add(particle);
    }
  }

  private clearFeedParticles(): void {
    while (this.feedParticles.children.length > 0) {
      const child = this.feedParticles.children[0];
      this.feedParticles.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  public updateAnimation(time: number, isFeeding: boolean): void {
    const bobAmount = Math.sin(time * 0.005) * 0.02;
    this.body.position.y = bobAmount;
    
    const armRotation = isFeeding 
      ? Math.sin(time * 0.01) * 0.3 
      : Math.sin(time * 0.002) * 0.05;
    this.arm.rotation.x = armRotation;

    if (isFeeding && !this.isFeeding) {
      this.startFeeding();
    } else if (!isFeeding && this.isFeeding) {
      this.stopFeeding();
    }

    if (this.isFeeding) {
      this.updateFeedParticles();
      this.feedTime++;
      
      if (this.feedTime % 3 === 0 && this.feedParticles.children.length < 50) {
        this.createFeedParticles();
      }
    }
  }

  private updateFeedParticles(): void {
    const toRemove: THREE.Object3D[] = [];
    
    this.feedParticles.children.forEach(particle => {
      const p = particle as THREE.Mesh;
      const vel = p.userData.velocity;
      
      p.position.x += vel.x;
      p.position.y += vel.y;
      p.position.z += vel.z;
      
      p.userData.life -= 0.02;
      
      if (p.userData.life <= 0) {
        toRemove.push(particle);
      } else {
        (p.material as THREE.MeshBasicMaterial).opacity = p.userData.life;
        (p.material as THREE.MeshBasicMaterial).transparent = true;
      }
    });

    toRemove.forEach(p => {
      this.feedParticles.remove(p);
      if (p instanceof THREE.Mesh) {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      }
    });
  }

  public updateCameraPosition(floor: number, position: number): void {
    const targetPos = getCagePosition(floor, position);
    
    this.camera.position.set(
      this.group.position.x,
      this.group.position.y + 0.35,
      this.group.position.z - 0.1
    );
    
    this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
  }

  public dispose(): void {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.clearFeedParticles();
  }
}
