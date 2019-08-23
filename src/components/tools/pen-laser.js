const InterpolationBuffer = require("buffered-interpolation");
import MobileStandardMaterial from "../../materials/MobileStandardMaterial";

function almostEquals(epsilon, u, v) {
  return Math.abs(u.x - v.x) < epsilon && Math.abs(u.y - v.y) < epsilon && Math.abs(u.z - v.z) < epsilon;
}

AFRAME.registerComponent("pen-laser", {
  schema: {
    color: { type: "color", default: "#FF0033" },
    laserVisible: { default: false },
    remoteLaserVisible: { default: false },
    laserOrigin: { default: { x: 0, y: 0, z: 0 } },
    remoteLaserOrigin: { default: { x: 0, y: 0, z: 0 } },
    laserTarget: { default: { x: 0, y: 0, z: 0 } }
  },

  init() {
    let material = new THREE.MeshStandardMaterial({ color: "red", opacity: 0.5, transparent: true, visible: true });
    if (window.APP && window.APP.quality === "low") {
      material = MobileStandardMaterial.fromStandardMaterial(material);
    }

    const tipMaterial = material.clone();

    const lineCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 2));
    const geometry = new THREE.TubeBufferGeometry(lineCurve, 2, 0.003, 8, true);
    this.laser = new THREE.Mesh(geometry, material);

    this.laserTip = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 8, 6), tipMaterial);
    this.laserTip.scale.setScalar(0.01);
    this.laserTip.matrixNeedsUpdate = true;

    const environmentMapComponent = this.el.sceneEl.components["environment-map"];
    if (environmentMapComponent) {
      environmentMapComponent.applyEnvironmentMap(this.laser);
      environmentMapComponent.applyEnvironmentMap(this.laserTip);
    }

    //prevents the line from being a raycast target for the cursor
    this.laser.raycast = function() {};

    this.el.sceneEl.setObject3D(`pen-laser-${this.laser.uuid}`, this.laser);
    this.el.sceneEl.setObject3D(`pen-laser-tip-${this.laser.uuid}`, this.laserTip);

    this.originBuffer = new InterpolationBuffer(InterpolationBuffer.MODE_LERP, 0.1);
    this.targetBuffer = new InterpolationBuffer(InterpolationBuffer.MODE_LERP, 0.1);
  },

  update: (() => {
    const originBufferPosition = new THREE.Vector3();
    const targetBufferPosition = new THREE.Vector3();

    return function(prevData) {
      if (prevData.color != this.data.color) {
        this.laser.material.color.set(this.data.color);
        this.laserTip.material.color.set(this.data.color);
      }

      if (prevData.remoteLaserOrigin && !almostEquals(0.001, prevData.remoteLaserOrigin, this.data.remoteLaserOrigin)) {
        this.originBuffer.setPosition(
          originBufferPosition.set(
            this.data.remoteLaserOrigin.x,
            this.data.remoteLaserOrigin.y,
            this.data.remoteLaserOrigin.z
          )
        );
      }

      if (prevData.laserTarget && !almostEquals(0.001, prevData.laserTarget, this.data.laserTarget)) {
        this.targetBuffer.setPosition(
          targetBufferPosition.set(this.data.laserTarget.x, this.data.laserTarget.y, this.data.laserTarget.z)
        );
      }
    };
  })(),

  tick(t, dt) {
    const isMine = this.el.parentEl.components.networked.initialized && this.el.parentEl.components.networked.isMine();
    let laserVisible = false;
    let origin, target;

    if (isMine && this.data.laserVisible) {
      origin = this.data.laserOrigin;
      target = this.data.laserTarget;
    } else if (!isMine && this.data.remoteLaserVisible) {
      this.originBuffer.update(dt);
      this.targetBuffer.update(dt);
      origin = this.originBuffer.getPosition();
      target = this.targetBuffer.getPosition();
    }

    if (origin && target) {
      this.laser.position.copy(origin);
      this.laser.lookAt(target);
      this.laser.scale.set(1, 1, origin.distanceTo(target));
      this.laser.matrixNeedsUpdate = true;
      this.laserTip.position.copy(target);
      this.laserTip.matrixNeedsUpdate = true;
      laserVisible = true;
    }

    if (this.laser.material.visible !== laserVisible) {
      this.laser.material.visible = laserVisible;
    }

    const laserTipVisible = laserVisible ? !(isMine && this.data.laserVisible) : false;
    if (this.laserTip.material.visible !== laserTipVisible) {
      this.laserTip.material.visible = laserTipVisible;
    }
  },

  remove() {
    this.el.sceneEl.removeObject3D(`pen-laser-${this.laser.uuid}`);
    this.el.sceneEl.removeObject3D(`pen-laser-tip-${this.laser.uuid}`);
  }
});