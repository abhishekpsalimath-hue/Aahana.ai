"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const shapes = {
  knot: { label: "Torus knot", geometry: () => new THREE.TorusKnotGeometry(0.92, 0.28, 160, 24) },
  sphere: { label: "Sphere", geometry: () => new THREE.SphereGeometry(1, 64, 48) },
  torus: { label: "Torus", geometry: () => new THREE.TorusGeometry(0.9, 0.32, 32, 96) },
  cube: { label: "Rounded form", geometry: () => new THREE.BoxGeometry(1.55, 1.55, 1.55, 8, 8, 8) },
};

export default function Creative3DStage() {
  const hostRef = useRef(null);
  const [shape, setShape] = useState("knot");
  const [wireframe, setWireframe] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    let frame = 0;
    let disposed = false;
    let pointerDown = false;
    let lastX = 0;
    let lastY = 0;
    let rotationX = 0;
    let rotationY = 0;
    let velocityX = 0;
    let velocityY = 0;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#100d19");
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 4.6);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.setAttribute("aria-label", "Interactive 3D object preview. Drag to rotate.");
      renderer.domElement.setAttribute("role", "img");
      host.replaceChildren(renderer.domElement);

      const ambient = new THREE.AmbientLight("#bba7ed", 1.5);
      const key = new THREE.DirectionalLight("#fff4e6", 3.2);
      key.position.set(3, 4, 5);
      const rim = new THREE.PointLight("#9c78ff", 18, 12);
      rim.position.set(-3, -1, -2);
      scene.add(ambient, key, rim);

      const geometry = shapes[shape].geometry();
      const material = new THREE.MeshPhysicalMaterial({
        color: "#bda0f5",
        metalness: 0.42,
        roughness: 0.22,
        clearcoat: 0.85,
        clearcoatRoughness: 0.16,
        wireframe,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const resize = () => {
        if (disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const onPointerDown = (event) => {
        pointerDown = true;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        setDragging(true);
      };
      const onPointerMove = (event) => {
        if (!pointerDown) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        velocityY = dx * 0.008;
        velocityX = dy * 0.008;
        rotationY += velocityY;
        rotationX += velocityX;
      };
      const onPointerUp = () => {
        pointerDown = false;
        setDragging(false);
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointercancel", onPointerUp);

      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        if (!pointerDown) {
          rotationY += 0.003;
          velocityX *= 0.94;
          velocityY *= 0.94;
          rotationX += velocityX;
          rotationY += velocityY;
        }
        mesh.rotation.x = rotationX;
        mesh.rotation.y = rotationY;
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointercancel", onPointerUp);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (cause) {
      setError("This device could not start a WebGL preview. Try a browser with hardware acceleration enabled.");
      return () => {
        disposed = true;
        if (renderer) renderer.dispose();
      };
    }
  }, [shape, wireframe]);

  return (
    <section className="creative-3d-stage" aria-label="Interactive 3D studio">
      <div className="creative-3d-heading">
        <div><span>CREATIVE STUDIO / 3D</span><h2>Shape a new dimension.</h2></div>
        <span className="creative-3d-live">LIVE VIEWPORT</span>
      </div>
      <div className="creative-3d-viewport" ref={hostRef}>
        {error && <p role="status">{error}</p>}
      </div>
      <div className="creative-3d-controls">
        <label>Object
          <select value={shape} onChange={(event) => setShape(event.target.value)}>
            {Object.entries(shapes).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}
          </select>
        </label>
        <label className="creative-3d-toggle"><input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} /> Wireframe</label>
        <span className="creative-3d-hint">{dragging ? "Drag to rotate" : "Drag object to explore"}</span>
      </div>
      <p className="creative-3d-note">Real-time Three.js preview · Procedural geometry · Runs in your browser</p>
    </section>
  );
}
