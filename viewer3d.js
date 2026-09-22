// CatASIC 3D viewer: turns a 24x24 cat into lit voxels.
(function () {
  "use strict";
  const THREE = window.THREE;
  // how far each layer sticks out (Background/Aura sit on a back panel)
  const DEPTH = { 0: 0, 1: 0, 2: 2, 3: 2, 4: 2.2, 5: 2.4, 6: 2.4, 7: 2.5, 8: 3, 9: 3, 10: 3.2 };

  class CatViewer {
    constructor(canvas) {
      this.canvas = canvas;
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
      this.camera.position.set(0, 0, 58);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.62));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(18, 24, 40);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x7fb4ff, 0.45);
      rim.position.set(-30, -10, -20);
      this.scene.add(rim);
      this.group = new THREE.Group();
      this.scene.add(this.group);
      this.box = new THREE.BoxGeometry(1, 1, 1);
      this.mat = new THREE.MeshLambertMaterial();
      this.mesh = null;
      this.panel = null;
      this.rotY = 0; this.rotX = 0; this.dragging = false; this.t = 0;
      this._bindDrag();
      this._resize();
      new ResizeObserver(() => this._resize()).observe(canvas);
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    _resize() {
      const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    _bindDrag() {
      let lx = 0, ly = 0;
      this.canvas.addEventListener("pointerdown", (e) => { this.dragging = true; lx = e.clientX; ly = e.clientY; this.canvas.setPointerCapture(e.pointerId); });
      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.dragging) return;
        this.rotY += (e.clientX - lx) * 0.01; this.rotX += (e.clientY - ly) * 0.01;
        this.rotX = Math.max(-0.8, Math.min(0.8, this.rotX));
        lx = e.clientX; ly = e.clientY;
      });
      const up = () => { this.dragging = false; };
      this.canvas.addEventListener("pointerup", up);
      this.canvas.addEventListener("pointercancel", up);
    }

    // cells: array(576) of {color, layer} | null
    show(cells) {
      if (this.mesh) { this.group.remove(this.mesh); this.mesh.dispose(); }
      if (this.panel) { this.group.remove(this.panel); this.panel.geometry.dispose(); this.panelTex.dispose(); this.panel.material.forEach((mm) => mm.dispose()); }
      // back panel: background + aura as a texture
      const cv = document.createElement("canvas");
      cv.width = 24; cv.height = 24;
      const ctx = cv.getContext("2d");
      const vox = [];
      cells.forEach((c, i) => {
        if (!c) return;
        const x = i % 24, y = Math.floor(i / 24);
        if (DEPTH[c.layer] === 0) { ctx.fillStyle = c.color; ctx.fillRect(x, y, 1, 1); }
        else vox.push({ x, y, c });
      });
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.panel = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 1), [
        new THREE.MeshLambertMaterial({ color: 0x1b1726 }), new THREE.MeshLambertMaterial({ color: 0x1b1726 }),
        new THREE.MeshLambertMaterial({ color: 0x1b1726 }), new THREE.MeshLambertMaterial({ color: 0x1b1726 }),
        new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ color: 0x1b1726 }),
      ]);
      this.panelTex = tex;
      this.panel.position.z = -0.5;
      this.group.add(this.panel);
      this.mesh = new THREE.InstancedMesh(this.box, this.mat, vox.length);
      const m = new THREE.Matrix4(), col = new THREE.Color();
      vox.forEach((v, i) => {
        const d = DEPTH[v.c.layer];
        m.makeScale(1, 1, d);
        m.setPosition(v.x - 11.5, 11.5 - v.y, d / 2);
        this.mesh.setMatrixAt(i, m);
        col.set(v.c.color); col.convertSRGBToLinear();
        this.mesh.setColorAt(i, col);
      });
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.group.add(this.mesh);
    }

    // one quick spin, used when a cat is found
    celebrate() { this.spin = Math.PI * 2; }

    _loop(ts) {
      this.t = ts / 1000;
      if (!this.dragging && !this.reduced) {
        const idleY = Math.sin(this.t * 0.6) * 0.45;
        const idleX = Math.sin(this.t * 0.4) * 0.12;
        this.rotY += (idleY - this.rotY) * 0.03;
        this.rotX += (idleX - this.rotX) * 0.03;
      }
      let extra = 0;
      if (this.spin > 0) { const s = Math.min(this.spin, 0.12); this.spin -= s; extra = Math.PI * 2 - this.spin; if (this.spin <= 0) extra = 0; }
      this.group.rotation.set(this.rotX, this.rotY + extra, 0);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this._loop);
    }
  }

  window.CatViewer = CatViewer;
})();
