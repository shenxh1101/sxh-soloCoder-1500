import * as THREE from 'three';
import { Cage } from '../types';
import { getCagePosition } from '../utils/dataGenerator';

export class CageRack {
  public group: THREE.Group;
  private cageMeshes: Map<string, THREE.Mesh> = new Map();
  private cageLabels: Map<string, THREE.Group> = new Map();
  private material: THREE.MeshStandardMaterial;
  private alertMaterial: THREE.MeshStandardMaterial;
  private selectedMaterial: THREE.MeshStandardMaterial;
  private normalMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    
    this.normalMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.3,
      roughness: 0.7,
    });
    
    this.alertMaterial = new THREE.MeshStandardMaterial({
      color: 0xe53e3e,
      metalness: 0.5,
      roughness: 0.5,
      emissive: 0xe53e3e,
      emissiveIntensity: 0.3,
    });
    
    this.selectedMaterial = new THREE.MeshStandardMaterial({
      color: 0x38a169,
      metalness: 0.4,
      roughness: 0.6,
      emissive: 0x38a169,
      emissiveIntensity: 0.2,
    });
    
    this.material = this.normalMaterial.clone();
    
    this.createRackStructure();
  }

  private createRackStructure(): void {
    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      metalness: 0.6,
      roughness: 0.4,
    });

    const frameGeometry = new THREE.BoxGeometry(0.1, 4.5, 0.1);
    const positions = [
      { x: -5.75, y: 2.25, z: -0.6 },
      { x: 5.75, y: 2.25, z: -0.6 },
      { x: -5.75, y: 2.25, z: 0.6 },
      { x: 5.75, y: 2.25, z: 0.6 },
    ];

    positions.forEach(pos => {
      const frame = new THREE.Mesh(frameGeometry, rackMaterial);
      frame.position.set(pos.x, pos.y, pos.z);
      frame.castShadow = true;
      frame.receiveShadow = true;
      this.group.add(frame);
    });

    for (let floor = 0; floor < 3; floor++) {
      const shelfGeometry = new THREE.BoxGeometry(12, 0.08, 1.2);
      const shelf = new THREE.Mesh(shelfGeometry, rackMaterial);
      shelf.position.set(0, 0.75 + floor * 1.5, 0);
      shelf.receiveShadow = true;
      this.group.add(shelf);
    }

    const railGeometry = new THREE.BoxGeometry(12.5, 0.05, 0.05);
    const topRail = new THREE.Mesh(railGeometry, rackMaterial);
    topRail.position.set(0, 5.2, 0);
    this.group.add(topRail);
  }

  public createCage(cage: Cage): void {
    const pos = getCagePosition(cage.floor, cage.position);
    
    const cageGroup = new THREE.Group();
    
    const cageGeometry = new THREE.BoxGeometry(1.3, 1.0, 0.9);
    const cageMesh = new THREE.Mesh(cageGeometry, this.normalMaterial.clone());
    cageMesh.position.set(pos.x, pos.y, pos.z);
    cageMesh.castShadow = true;
    cageMesh.receiveShadow = true;
    cageMesh.userData = { cageId: cage.id };
    
    const edgeGeometry = new THREE.EdgesGeometry(cageGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x718096 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(cageMesh.position);
    
    const frontFrameGeometry = new THREE.BoxGeometry(1.35, 1.05, 0.02);
    const frontFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      transparent: true,
      opacity: 0.3,
    });
    const frontFrame = new THREE.Mesh(frontFrameGeometry, frontFrameMaterial);
    frontFrame.position.set(pos.x, pos.y, pos.z + 0.46);
    
    cageGroup.add(cageMesh);
    cageGroup.add(edges);
    cageGroup.add(frontFrame);
    
    this.cageMeshes.set(cage.id, cageMesh);
    this.group.add(cageGroup);
  }

  public updateCage(cage: Cage, time: number): void {
    const mesh = this.cageMeshes.get(cage.id);
    if (!mesh) return;

    let targetMaterial: THREE.MeshStandardMaterial;
    
    if (cage.hasAlert) {
      const flashIntensity = (Math.sin(time * 0.008) + 1) / 2;
      targetMaterial = this.alertMaterial.clone();
      targetMaterial.emissiveIntensity = flashIntensity * 0.8;
    } else if (cage.isSelected) {
      targetMaterial = this.selectedMaterial.clone();
    } else {
      targetMaterial = this.normalMaterial.clone();
    }
    
    mesh.material = targetMaterial;
  }

  public getCageMesh(cageId: string): THREE.Mesh | undefined {
    return this.cageMeshes.get(cageId);
  }

  public getAllCageMeshes(): THREE.Mesh[] {
    return Array.from(this.cageMeshes.values());
  }

  public dispose(): void {
    this.cageMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.cageLabels.forEach(label => {
      label.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    });
    this.normalMaterial.dispose();
    this.alertMaterial.dispose();
    this.selectedMaterial.dispose();
    this.cageMeshes.clear();
    this.cageLabels.clear();
  }
}
