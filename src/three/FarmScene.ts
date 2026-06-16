import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CageRack } from './CageRack';
import { Robot } from './Robot';
import { Cage, RobotState } from '../types';
import { getCagePosition } from '../utils/dataGenerator';

export class FarmScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cageRack: CageRack;
  private robot: Robot;
  private container: HTMLElement;
  private animationId: number | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private onCageClick: ((cageId: string) => void) | null = null;
  private sensorLabels: Map<string, HTMLDivElement> = new Map();
  private labelRenderer: HTMLElement | null = null;

  private robotRenderTarget: THREE.WebGLRenderTarget;
  private robotViewCanvas: HTMLCanvasElement;
  private robotViewCtx: CanvasRenderingContext2D | null = null;
  private lastRenderTime: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 15, 40);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(8, 6, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.robotRenderTarget = new THREE.WebGLRenderTarget(480, 270, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    this.robotViewCanvas = document.createElement('canvas');
    this.robotViewCanvas.width = 480;
    this.robotViewCanvas.height = 270;
    this.robotViewCtx = this.robotViewCanvas.getContext('2d');

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 25;
    this.controls.target.set(0, 2, 0);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.cageRack = new CageRack();
    this.robot = new Robot();

    this.setupLighting();
    this.setupGround();
    this.createLabelContainer();
    this.setupEventListeners();
  }

  public getRobotViewCanvas(): HTMLCanvasElement {
    return this.robotViewCanvas;
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4da6ff, 0.3);
    fillLight.position.set(-10, 8, -5);
    this.scene.add(fillLight);

    const rackLight1 = new THREE.PointLight(0x38a169, 0.5, 10);
    rackLight1.position.set(-4, 3, 2);
    this.scene.add(rackLight1);

    const rackLight2 = new THREE.PointLight(0x38a169, 0.5, 10);
    rackLight2.position.set(4, 3, 2);
    this.scene.add(rackLight2);
  }

  private setupGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.1,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(50, 50, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    const railSupportGeometry = new THREE.BoxGeometry(0.1, 5.5, 0.1);
    const railSupportMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.3,
    });

    [-6.5, 6.5].forEach(x => {
      const support = new THREE.Mesh(railSupportGeometry, railSupportMaterial);
      support.position.set(x, 2.75, 2);
      support.castShadow = true;
      this.scene.add(support);
    });

    const railGeometry = new THREE.BoxGeometry(14, 0.08, 0.08);
    const rail = new THREE.Mesh(railGeometry, railSupportMaterial);
    rail.position.set(0, 5.5, 2);
    this.scene.add(rail);
  }

  private createLabelContainer(): void {
    this.labelRenderer = document.createElement('div');
    this.labelRenderer.style.position = 'absolute';
    this.labelRenderer.style.top = '0';
    this.labelRenderer.style.left = '0';
    this.labelRenderer.style.width = '100%';
    this.labelRenderer.style.height = '100%';
    this.labelRenderer.style.pointerEvents = 'none';
    this.labelRenderer.style.overflow = 'hidden';
    this.container.appendChild(this.labelRenderer);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
  }

  private onResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private onMouseClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cageRack.getAllCageMeshes());

    if (intersects.length > 0) {
      const cageId = intersects[0].object.userData.cageId;
      if (cageId && this.onCageClick) {
        this.onCageClick(cageId);
      }
    }
  }

  public setOnCageClick(callback: (cageId: string) => void): void {
    this.onCageClick = callback;
  }

  public initializeCages(cages: Cage[]): void {
    cages.forEach(cage => {
      this.cageRack.createCage(cage);
      this.createSensorLabel(cage);
    });
    this.scene.add(this.cageRack.group);
    this.scene.add(this.robot.group);
  }

  private createSensorLabel(cage: Cage): void {
    const label = document.createElement('div');
    label.className = 'sensor-label';
    label.style.position = 'absolute';
    label.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    label.style.border = '1px solid #334155';
    label.style.borderRadius = '6px';
    label.style.padding = '6px 10px';
    label.style.fontSize = '11px';
    label.style.fontFamily = "'JetBrains Mono', monospace";
    label.style.color = '#e2e8f0';
    label.style.whiteSpace = 'nowrap';
    label.style.transform = 'translate(-50%, -50%)';
    label.style.backdropFilter = 'blur(8px)';
    label.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '10';

    this.sensorLabels.set(cage.id, label);
    if (this.labelRenderer) {
      this.labelRenderer.appendChild(label);
    }
  }

  private updateSensorLabel(cage: Cage, camera: THREE.Camera): void {
    const label = this.sensorLabels.get(cage.id);
    if (!label) return;

    const pos = getCagePosition(cage.floor, cage.position);
    const vector = new THREE.Vector3(pos.x, pos.y + 0.8, pos.z);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-(vector.y * 0.5) + 0.5) * this.container.clientHeight;

    if (vector.z > 1) {
      label.style.display = 'none';
      return;
    }

    label.style.display = 'block';
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    const tempColor = cage.alertType === 'temperature' ? '#ef4444' : '#22c55e';
    const humColor = cage.alertType === 'humidity' ? '#ef4444' : '#3b82f6';

    label.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 2px; color: #f1f5f9;">${cage.id}</div>
      <div style="color: ${tempColor};">🌡️ ${cage.temperature.toFixed(1)}°C</div>
      <div style="color: ${humColor};">💧 ${cage.humidity.toFixed(1)}%</div>
    `;
  }

  public update(cages: Cage[], robotState: RobotState, time: number): void {
    cages.forEach(cage => {
      this.cageRack.updateCage(cage, time);
      this.updateSensorLabel(cage, this.camera);
    });

    this.robot.updatePosition(
      robotState.position.x,
      robotState.position.y,
      robotState.position.z,
      time
    );

    const targetCageId = robotState.targetCageId || robotState.currentCageId;
    if (targetCageId) {
      const targetCage = cages.find(c => c.id === targetCageId);
      if (targetCage) {
        this.robot.updateCameraPosition(targetCage.floor, targetCage.position);
      }
    }

    this.robot.updateAnimation(time, robotState.status === 'feeding');
  }

  public render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (performance.now() - this.lastRenderTime > 50) {
      this.renderRobotView();
      this.lastRenderTime = performance.now();
    }
  }

  private renderRobotView(): void {
    const robotCam = this.robot.camera;
    if (!robotCam) return;

    this.renderer.setRenderTarget(this.robotRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, robotCam);
    this.renderer.setRenderTarget(null);

    if (this.robotViewCtx) {
      const pixels = new Uint8Array(480 * 270 * 4);
      this.renderer.readRenderTargetPixels(
        this.robotRenderTarget,
        0, 0, 480, 270,
        pixels
      );

      const imageData = this.robotViewCtx.createImageData(480, 270);
      for (let i = 0; i < pixels.length; i += 4) {
        const y = Math.floor(i / 4 / 480);
        const flippedY = 269 - y;
        const targetIdx = (flippedY * 480 + (i / 4) % 480) * 4;
        imageData.data[targetIdx] = pixels[i];
        imageData.data[targetIdx + 1] = pixels[i + 1];
        imageData.data[targetIdx + 2] = pixels[i + 2];
        imageData.data[targetIdx + 3] = 255;
      }
      this.robotViewCtx.putImageData(imageData, 0, 0);
    }
  }

  public startAnimationLoop(callback?: (time: number) => void): void {
    const animate = (time: number) => {
      this.animationId = requestAnimationFrame(animate);
      if (callback) callback(time);
      this.render();
    };
    animate(0);
  }

  public stopAnimationLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public getRobotCamera(): THREE.PerspectiveCamera {
    return this.robot.camera;
  }

  public focusOnCage(cageId: string): void {
    const cage = this.cageRack.getCageMesh(cageId);
    if (cage) {
      this.controls.target.copy(cage.position);
      this.controls.update();
    }
  }

  public dispose(): void {
    this.stopAnimationLoop();
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.removeEventListener('click', this.onMouseClick.bind(this));

    this.sensorLabels.forEach(label => {
      if (this.labelRenderer) {
        this.labelRenderer.removeChild(label);
      }
    });
    this.sensorLabels.clear();

    if (this.labelRenderer && this.labelRenderer.parentNode) {
      this.labelRenderer.parentNode.removeChild(this.labelRenderer);
    }

    this.robotRenderTarget.dispose();
    this.cageRack.dispose();
    this.robot.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
