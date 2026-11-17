"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const SHAPES = {
  sphere: () => new THREE.SphereGeometry(1, 64, 48),
  box: () => new THREE.BoxGeometry(1.7, 1.7, 1.7, 4, 4, 4),
  torus: () => new THREE.TorusKnotGeometry(.72, .24, 180, 24, 2, 3),
  cone: () => new THREE.ConeGeometry(.9, 1.8, 64, 8),
  icosahedron: () => new THREE.IcosahedronGeometry(1, 3),
  torusKnot: () => new THREE.TorusGeometry(.72, .28, 32, 100),
};

export default function Native3DStudio() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const meshRef = useRef(null);
  const rendererRef = useRef(null);
  const [shape, setShape] = useState("sphere");
  const [color, setColor] = useState("#b9a5d4");
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [status, setStatus] = useState("Interactive 3D scene ready.");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#171421");
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    camera.position.set(3.2, 2.4, 4.8);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .065;
    controls.minDistance = 2.4;
    controls.maxDistance = 9;
    controls.target.set(0, 0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    const ambient = new THREE.HemisphereLight(0xe8ddff, 0x30263e, 2.0);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(0xb99ae9, 22, 12);
    rim.position.set(-3, 1, -2); scene.add(rim);
    const floor = new THREE.GridHelper(12, 24, 0x695780, 0x342c43);
    floor.position.y = -1.55; scene.add(floor);
    const material = new THREE.MeshPhysicalMaterial({ color, roughness: .27, metalness: .12, clearcoat: .75, clearcoatRoughness: .2 });
    const mesh = new THREE.Mesh(SHAPES.sphere(), material);
    scene.add(mesh);
    sceneRef.current = scene; meshRef.current = mesh; rendererRef.current = renderer;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(240, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    let frame = 0;
    let active = true;
    const draw = () => {
      if (!active) return;
      frame = window.requestAnimationFrame(draw);
      controls.update();
      if (meshRef.current && autoRotateRef.current) {
        meshRef.current.rotation.y += .006;
        meshRef.current.rotation.x += .0015;
      }
      renderer.render(scene, camera);
    };
    draw();
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mesh.geometry.dispose();
      mesh.material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null; meshRef.current = null; rendererRef.current = null;
    };
  }, []);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const previous = mesh.geometry;
    mesh.geometry = SHAPES[shape]();
    previous.dispose();
    mesh.geometry.computeVertexNormals();
  }, [shape]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.material.color.set(color);
    mesh.material.wireframe = wireframe;
    mesh.material.needsUpdate = true;
  }, [color, wireframe]);

  async function exportGlb() {
    const scene = sceneRef.current;
    if (!scene) return;
    setStatus("Preparing GLB export…");
    try {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      const exporter = new GLTFExporter();
      exporter.parse(scene, (result) => {
        const blob = new Blob([result], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = "aahana-3d-scene.glb"; anchor.click();
        URL.revokeObjectURL(url);
        setStatus("GLB scene exported. It contains the procedural scene and lighting.");
      }, (error) => {
        setStatus(error?.message || "GLB export failed.");
      }, { binary: true });
    } catch (error) {
      setStatus(error?.message || "GLB exporter could not be loaded.");
    }
  }

  return (
    <section className="native-3d-studio" aria-label="Aahana native 3D studio">
      <div className="native-3d-heading"><div><span>AAHANA-NATIVE SPATIAL ENGINE</span><h3>3D Creation Studio</h3><p>Build and inspect procedural 3D objects, then export a GLB scene.</p></div><button type="button" onClick={exportGlb}>Export GLB</button></div>
      <div className="native-3d-workspace">
        <div className="native-3d-viewport" ref={mountRef} aria-label="Interactive 3D viewport" />
        <div className="native-3d-controls">
          <label>Geometry<select value={shape} onChange={(event) => setShape(event.target.value)}><option value="sphere">Sphere</option><option value="box">Subdivided cube</option><option value="torus">Torus knot</option><option value="cone">Cone</option><option value="icosahedron">Icosphere</option><option value="torusKnot">Torus</option></select></label>
          <label>Material colour<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <label className="native-3d-check"><input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} /> Wireframe view</label>
          <label className="native-3d-check"><input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} /> Auto rotate</label>
          <p>Drag to orbit · pinch or scroll to zoom · two-finger drag to pan.</p>
          <button type="button" onClick={() => { if (meshRef.current) { meshRef.current.rotation.set(0, 0, 0); setStatus("Object rotation reset."); } }}>Reset rotation</button>
        </div>
      </div>
      <p className="native-3d-status" role="status">{status}</p>
      <small className="native-3d-disclosure">Current capability: procedural geometry, real-time WebGL materials and GLB export. Text-to-3D neural generation, sculpting and physics simulation are not connected yet.</small>
    </section>
  );
}
