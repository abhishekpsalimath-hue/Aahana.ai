"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function UniverseScene() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const compact = window.matchMedia?.("(max-width: 760px)").matches === true;
    // Mobile uses a lower-cost WebGL profile rather than falling back to a flat backdrop.
    let renderer, raf = 0, active = true, inView = true, observer, contextAvailable = true;
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery?.matches === true;
    // Pointer movement also receives touch-drag PointerEvents on phones.
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power", stencil: false });
    } catch {
      canvas.dataset.webglFallback = "true";
      return undefined;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    camera.position.set(0, 0, 15.5);
    camera.lookAt(0, 0, -2.6);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.2));
    renderer.setClearColor(0x05040a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    // A distant, animated volumetric-style nebula gives the scene real depth
    // instead of relying entirely on flat CSS gradients and glowing particle dots.
    const nebulaMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p);
          f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
        }
        float fbm(vec2 p){
          float value=0.0, amplitude=0.5;
          for(int i=0;i<4;i++){ value+=noise(p)*amplitude; p=p*2.03+vec2(17.2,9.4); amplitude*=0.5; }
          return value;
        }
        void main(){
          vec2 p=(vUv-0.5)*vec2(1.75,1.0);
          float t=uTime*0.00012;
          float warp=fbm(p*2.2+vec2(t,-t*0.7));
          vec2 q=p+vec2(warp-0.5,fbm(p*1.7+4.0)-0.5)*0.48;
          float clouds=fbm(q*4.4+vec2(-t*0.45,t*0.22));
          float filaments=fbm(q*9.0+clouds*1.8);
          float mask=smoothstep(0.47,0.79,clouds*0.72+filaments*0.38);
          float wisps=smoothstep(0.54,0.82,filaments)*mask;
          vec3 violet=vec3(0.23,0.14,0.42);
          vec3 lilac=vec3(0.48,0.34,0.72);
          vec3 blue=vec3(0.20,0.29,0.53);
          vec3 color=mix(violet,lilac,smoothstep(0.38,0.72,clouds));
          color=mix(color,blue,smoothstep(0.48,0.82,fbm(q*2.1+8.0))*0.62);
          color+=vec3(0.25,0.18,0.38)*wisps*0.5;
          float edge=1.0-smoothstep(0.38,0.88,length(p*vec2(0.82,1.12)));
          float alpha=mask*edge*0.34+wisps*edge*0.12;
          gl_FragColor=vec4(color,alpha);
        }`,
    });
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(100, 66), nebulaMaterial);
    nebula.position.set(0, 0, -34);
    nebula.renderOrder = -2;
    scene.add(nebula);

    const world = new THREE.Group();
    world.position.z = -2.5;
    scene.add(world);
    scene.add(new THREE.AmbientLight(0x9c8bbf, 0.72));
    const keyLight = new THREE.PointLight(0xd8c4ff, 42, 38, 1.8);
    keyLight.position.set(-4, 5, 7);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x7e8fe9, 24, 34, 1.7);
    rimLight.position.set(7, -2, -3);
    scene.add(rimLight);

    const starCount = compact ? 1150 : 1500;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [new THREE.Color(0xffffff), new THREE.Color(0xcbb8ff), new THREE.Color(0x9eafea)];
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 48, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
      starPositions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi) - 8], i * 3);
      const c = palette[Math.floor(Math.random() * palette.length)];
      starColors.set([c.r, c.g, c.b], i * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: compact ? 0.045 : 0.052, vertexColors: true, transparent: true, opacity: 0.78, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(stars);

    // The former central galaxy was intentionally removed. The scene now
    // uses distributed planetary forms, atmospheric depth and moving stars.


    const planets = [];
    const cloudLayers = [];
    const planetLightBindings = [];
    const makePlanetMaps = (seed, colors) => {
      // Keep procedural texture work bounded on phones while retaining enough
      // texel detail for the planets at their on-screen size.
      const width = compact ? 256 : 320, height = compact ? 128 : 160;
      const surface = document.createElement("canvas");
      surface.width = width;
      surface.height = height;
      const context = surface.getContext("2d", { willReadFrequently: true });
      if (!context) return { map: null, bumpMap: null };
      const image = context.createImageData(width, height);
      const bump = context.createImageData(width, height);
      const c0 = new THREE.Color(colors[0]);
      const c1 = new THREE.Color(colors[1]);
      const c2 = new THREE.Color(colors[2]);
      const p0 = c0, p1 = c1, p2 = c2;
      const toSRGBByte = (linear) => {
        const value = Math.max(0, Math.min(1, linear));
        return Math.round((value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055) * 255);
      };
      // Periodic value-noise keeps the equirectangular texture seamless at its
      // longitude seam while producing broad continents and finer terrain.
      const hash = (x, y) => {
        const n = Math.sin((x + seed * 19.17) * 127.1 + (y + seed * 7.31) * 311.7) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
      };
      const smooth = (t) => t * t * (3 - 2 * t);
      const valueNoise = (u, v, scaleX, scaleY) => {
        const px = u * scaleX, py = v * scaleY;
        const ix = Math.floor(px), iy = Math.floor(py);
        const fx = smooth(px - ix), fy = smooth(py - iy);
        const x0 = ((ix % scaleX) + scaleX) % scaleX, x1 = (x0 + 1) % scaleX;
        const a = hash(x0, iy), b = hash(x1, iy), c = hash(x0, iy + 1), d = hash(x1, iy + 1);
        const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
        return top + (bottom - top) * fy;
      };
      const smoothRange = (a, b, value) => {
        const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      for (let y = 0; y < height; y++) {
        const v = y / height;
        const latitude = Math.abs(v - 0.5) * 2;
        for (let x = 0; x < width; x++) {
          const u = x / width;
          const broad = valueNoise(u, v, 6, 4);
          const medium = valueNoise(u, v, 18, 10);
          const fine = valueNoise(u, v, 54, 28);
          const warp = valueNoise(u, v, 12, 7) * 0.075;
          const continental = broad * 0.68 + medium * 0.25 + fine * 0.07 + warp;
          const land = smoothRange(-0.12, 0.16, continental);
          const ridges = 1 - Math.abs(valueNoise(u, v, 42, 22) * 0.72 + valueNoise(u, v, 96, 48) * 0.28);
          const terrain = Math.pow(Math.max(0, ridges), 2.1);
          const oceanDepth = Math.max(0, -continental);
          const polar = smoothRange(0.78, 0.98, latitude);
          const terrainTone = Math.min(1, Math.max(0, land * (0.42 + terrain * 0.58) + polar * 0.16));
          const oceanTone = Math.min(1, Math.max(0, 0.16 + oceanDepth * 0.28 + medium * 0.08));
          const baseR = p0.r + (p1.r - p0.r) * land;
          const baseG = p0.g + (p1.g - p0.g) * land;
          const baseB = p0.b + (p1.b - p0.b) * land;
          const colorMix = terrainTone * 0.42 + (1 - land) * oceanTone * 0.12;
          const colorR = baseR + (p2.r - baseR) * colorMix;
          const colorG = baseG + (p2.g - baseG) * colorMix;
          const colorB = baseB + (p2.b - baseB) * colorMix;
          const shade = Math.max(0.48, Math.min(1.12, 0.82 + fine * 0.12 + terrain * 0.12 - latitude * 0.07));
          const index = (y * width + x) * 4;
          image.data[index] = toSRGBByte(colorR * shade);
          image.data[index + 1] = toSRGBByte(colorG * shade);
          image.data[index + 2] = toSRGBByte(colorB * shade);
          image.data[index + 3] = 255;
          const relief = Math.max(0, Math.min(255, 112 + (land * terrain - oceanDepth * 0.18 + fine * 0.12) * 92));
          bump.data[index] = relief;
          bump.data[index + 1] = relief;
          bump.data[index + 2] = relief;
          bump.data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      const bumpCanvas = document.createElement("canvas");
      bumpCanvas.width = width;
      bumpCanvas.height = height;
      const bumpContext = bumpCanvas.getContext("2d");
      bumpContext?.putImageData(bump, 0, 0);
      const map = new THREE.CanvasTexture(surface);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const bumpMap = bumpContext ? new THREE.CanvasTexture(bumpCanvas) : null;
      if (bumpMap) {
        bumpMap.wrapS = THREE.RepeatWrapping;
        bumpMap.anisotropy = map.anisotropy;
      }
      return { map, bumpMap };
    };
    const addPlanet = (x, y, z, radius, color, palette, ring = false, seed = 1) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const maps = makePlanetMaps(seed, palette);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 64, 48),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: maps.map || null,
          bumpMap: maps.bumpMap || null,
          bumpScale: radius * 0.035,
          roughness: 0.84,
          metalness: 0.015,
          emissive: new THREE.Color(color).multiplyScalar(0.045),
        })
      );
      group.add(body);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uLightDirection: { value: new THREE.Vector3(1, 0, 0) } },
        vertexShader: `
          varying vec3 vAtmosphereNormal;
          varying vec3 vAtmosphereView;
          varying vec3 vAtmospherePosition;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vAtmosphereNormal = normalize(normalMatrix * normal);
            vAtmosphereView = -mvPosition.xyz;
            vAtmospherePosition = normalize(position);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vAtmosphereNormal;
          varying vec3 vAtmosphereView;
          varying vec3 vAtmospherePosition;
          uniform vec3 uLightDirection;
          void main() {
            float viewFacing = max(dot(normalize(vAtmosphereNormal), normalize(vAtmosphereView)), 0.0);
            float rim = pow(1.0 - viewFacing, 2.1);
            float sunFacing = dot(normalize(vAtmospherePosition), normalize(uLightDirection));
            float daylight = smoothstep(-0.38, 0.48, sunFacing);
            float twilight = exp(-abs(sunFacing + 0.04) * 5.0);
            vec3 dayColor = vec3(0.34, 0.48, 0.92);
            vec3 nightColor = vec3(0.20, 0.13, 0.42);
            vec3 atmosphereColor = mix(nightColor, dayColor, daylight);
            atmosphereColor += vec3(0.34, 0.20, 0.52) * twilight * 0.42;
            float alpha = rim * (0.075 + daylight * 0.12);
            gl_FragColor = vec4(atmosphereColor, alpha);
          }
        `,
      });
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.11, 48, 32), atmosphereMaterial);
      group.add(atmosphere);
      planetLightBindings.push({ object: atmosphere, material: atmosphereMaterial });

      // A slow, translucent cloud deck adds a second physical layer to the
      // hero planet. The field is evaluated in 3D sphere space, so it has no
      // longitude seam and does not depend on downloaded texture assets.
      if (radius > 0.8) {
        const cloudMaterial = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          uniforms: {
            // The local-space light direction is refreshed as each layer rotates.
            uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
          },
          vertexShader: `
            varying vec3 vCloudPosition;
            varying vec3 vCloudNormal;
            varying vec3 vCloudViewPosition;
            void main() {
              vCloudPosition = normalize(position);
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vCloudNormal = normalize(normalMatrix * normal);
              vCloudViewPosition = -viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vCloudPosition;
            varying vec3 vCloudNormal;
            varying vec3 vCloudViewPosition;
            uniform vec3 uLightDirection;
            float hash(vec3 p) {
              return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }
            float noise(vec3 p) {
              vec3 i = floor(p), f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              float n000 = hash(i);
              float n100 = hash(i + vec3(1.0, 0.0, 0.0));
              float n010 = hash(i + vec3(0.0, 1.0, 0.0));
              float n110 = hash(i + vec3(1.0, 1.0, 0.0));
              float n001 = hash(i + vec3(0.0, 0.0, 1.0));
              float n101 = hash(i + vec3(1.0, 0.0, 1.0));
              float n011 = hash(i + vec3(0.0, 1.0, 1.0));
              float n111 = hash(i + vec3(1.0, 1.0, 1.0));
              float z0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
              float z1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
              return mix(z0, z1, f.z);
            }
            float fbm(vec3 p) {
              float value = 0.0, amplitude = 0.5;
              for (int i = 0; i < 3; i++) {
                value += noise(p) * amplitude;
                p = p * 2.03 + vec3(13.1, 7.7, 19.3);
                amplitude *= 0.5;
              }
              return value;
            }
            void main() {
              vec3 base = vCloudPosition * 5.4;
              // Single-octave warp samples retain broken-up cloud silhouettes
              // without running two additional full fractal-noise stacks per pixel.
              float warpA = noise(base * 0.42 + vec3(4.2, 1.7, 8.1));
              float warpB = noise(base * 0.42 + vec3(9.4, 6.3, 2.8));
              vec3 warped = base + vec3(warpA - 0.5, warpB - 0.5, warpA - warpB) * 1.65;
              float broad = fbm(warped);
              float detail = fbm(warped * 2.15 + vec3(3.7, 8.2, 1.4));
              float field = broad * 0.76 + detail * 0.24;
              float cloud = smoothstep(0.49, 0.67, field) * (1.0 - smoothstep(0.81, 0.94, field));
              float facing = max(dot(normalize(vCloudNormal), normalize(vCloudViewPosition)), 0.0);
              float limb = pow(1.0 - facing, 0.72);
              float sunFacing = dot(normalize(vCloudPosition), normalize(uLightDirection));
              float daylight = smoothstep(-0.24, 0.52, sunFacing);
              float terminator = exp(-abs(sunFacing - 0.02) * 8.0);
              vec3 shadowCloud = vec3(0.20, 0.19, 0.31);
              vec3 sunlitCloud = vec3(0.88, 0.85, 1.0);
              vec3 cloudColor = mix(shadowCloud, sunlitCloud, daylight);
              cloudColor += vec3(0.19, 0.16, 0.31) * terminator * 0.24;
              float alpha = cloud * (0.045 + daylight * 0.105 + limb * 0.075);
              gl_FragColor = vec4(cloudColor, alpha);
            }
          `,
        });
        const cloudDeck = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 64, 48), cloudMaterial);
        group.add(cloudDeck);
        cloudLayers.push(cloudDeck);
        planetLightBindings.push({ object: cloudDeck, material: cloudMaterial });
      }
      if (ring) {
        const rings = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.35, radius * 2.05, 128),
          new THREE.MeshStandardMaterial({ color: 0xc8b4ee, roughness: 0.88, metalness: 0.12, transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false })
        );
        rings.rotation.x = Math.PI / 2.35;
        rings.rotation.y = 0.18;
        group.add(rings);
      }
      world.add(group);
      planets.push(group);
    };
    addPlanet(-5.6, 1.7, -2.4, 0.92, 0x8d73bc, [0x2e294e, 0x8170a6, 0xd0b8e8], false, 2.7);
    addPlanet(5.2, 1.1, -5.1, 0.64, 0x7782bd, [0x4c527b, 0x858bb7, 0xc6b8df], true, 5.3);
    addPlanet(2.6, -3.1, 0.1, 0.34, 0xb57d9f, [0x583c65, 0xa76f91, 0xe4b7ca], false, 8.1);

    // Small moons orbit their parent worlds, making the planetary system feel lived-in.
    const moonOrbits = [];
    const addMoon = (parent, distance, size, color, speed) => {
      const orbit = new THREE.Group();
      const path = new THREE.Mesh(new THREE.TorusGeometry(distance, 0.006, 5, 72), new THREE.MeshBasicMaterial({ color: 0xbba9e8, transparent: true, opacity: 0.22 }));
      orbit.add(path);
      const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 2), new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 }));
      moon.position.x = distance;
      orbit.add(moon);
      parent.add(orbit);
      moonOrbits.push({ orbit, speed });
    };
    addMoon(planets[0], 1.28, 0.105, 0xc9c1d9, 0.0019);
    addMoon(planets[1], 0.92, 0.075, 0xb8c2dc, -0.0025);

    // Living travellers: astronauts and friendly alien explorers move through
    // the same 3D scene on independent, gently varied trajectories.
    const travellers = [];
    const astronautSuit = new THREE.MeshStandardMaterial({ color: 0xe8e4f2, roughness: 0.58, metalness: 0.12 });
    const astronautTrim = new THREE.MeshStandardMaterial({ color: 0x9b82ca, roughness: 0.42, metalness: 0.35, emissive: 0x24153e });
    const visorMaterial = new THREE.MeshPhysicalMaterial({ color: 0x18233c, metalness: 0.72, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x243e70, emissiveIntensity: 0.32 });
    const createAstronaut = (scale = 1) => {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 5, 10), astronautSuit);
      torso.position.y = -0.03; g.add(torso);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), astronautSuit);
      helmet.position.set(0, 0.31, 0.015); g.add(helmet);
      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 16), visorMaterial);
      visor.scale.set(1, 0.78, 0.48); visor.position.set(0, 0.32, 0.145); g.add(visor);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.29, 0.13), astronautTrim);
      pack.position.set(0, -0.03, -0.19); g.add(pack);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), astronautSuit);
        arm.position.set(side * 0.23, 0.02, 0); arm.rotation.z = side * -0.48; g.add(arm);
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), astronautSuit);
        leg.position.set(side * 0.09, -0.34, 0.015); leg.rotation.z = side * 0.08; g.add(leg);
        const boot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), astronautTrim);
        boot.scale.set(1, 0.65, 1.25); boot.position.set(side * 0.09, -0.49, 0.045); g.add(boot);
      }
      const shoulderLight = new THREE.PointLight(0xbca0ff, 0.55, 1.8);
      shoulderLight.position.set(0, 0.12, 0.2); g.add(shoulderLight);
      g.scale.setScalar(scale);
      return g;
    };
    const createFriendlyAlien = (scale = 1) => {
      const g = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: 0x8ec9bd, roughness: 0.48, metalness: 0.04, emissive: 0x173d3a, emissiveIntensity: 0.12 });
      const dark = new THREE.MeshPhysicalMaterial({ color: 0x10182b, roughness: 0.12, metalness: 0.22, clearcoat: 1 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), skin);
      body.scale.set(0.82, 1.2, 0.72); body.position.y = -0.12; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 18), skin);
      head.scale.set(0.92, 1.18, 0.78); head.position.y = 0.18; g.add(head);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), dark);
        eye.scale.set(0.78, 1.15, 0.42); eye.position.set(side * 0.085, 0.2, 0.174); g.add(eye);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xd9f5ff }));
        glint.position.set(side * 0.085 - 0.012, 0.22, 0.197); g.add(glint);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 4, 8), skin);
        arm.position.set(side * 0.17, -0.1, 0); arm.rotation.z = side * -0.55; g.add(arm);
      }
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.12, 8), skin);
      antenna.position.set(0, 0.46, 0); g.add(antenna);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb9f5e9 }));
      tip.position.set(0, 0.53, 0); g.add(tip);
      g.scale.setScalar(scale);
      return g;
    };
    const addTraveller = (object, config) => {
      object.position.set(config.x, config.y, config.z);
      object.rotation.set(config.rx || 0, config.ry || 0, config.rz || 0);
      world.add(object);
      travellers.push({ object, ...config, phase: Math.random() * Math.PI * 2, speed: config.speed || 0.006 });
    };
    addTraveller(createAstronaut(compact ? 0.62 : 0.82), { x: -3.6, y: -0.8, z: 1.6, speed: 0.0036, rangeX: 1.8, rangeY: 0.9, rangeZ: 12, rz: 0.22 });
    addTraveller(createAstronaut(compact ? 0.48 : 0.64), { x: 4.3, y: 2.3, z: -7.5, speed: 0.0028, rangeX: 1.4, rangeY: 1.1, rangeZ: 15, rz: -0.35 });
    addTraveller(createFriendlyAlien(compact ? 0.56 : 0.72), { x: 2.4, y: -1.5, z: -4.8, speed: 0.0024, rangeX: 1.2, rangeY: 0.8, rangeZ: 13, ry: -0.3 });
    addTraveller(createFriendlyAlien(compact ? 0.46 : 0.58), { x: -4.8, y: 2.5, z: -12, speed: 0.0019, rangeX: 1.5, rangeY: 0.7, rangeZ: 16, ry: 0.5 });

    // A distant black hole with a luminous accretion disc adds a second
    // large-scale landmark; its core remains dark rather than a glowing ball.
    const blackHole = new THREE.Group();
    blackHole.position.set(6.8, -3.8, -20);
    const singularity = new THREE.Mesh(new THREE.SphereGeometry(1.08, 40, 32), new THREE.MeshBasicMaterial({ color: 0x020106 }));
    blackHole.add(singularity);
    const disk = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.24, 12, 100),
      new THREE.MeshBasicMaterial({ color: 0xb58aff, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending })
    );
    disk.rotation.x = 1.12; disk.rotation.y = 0.18; blackHole.add(disk);
    const diskInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.07, 10, 100),
      new THREE.MeshBasicMaterial({ color: 0xf1c5ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
    );
    diskInner.rotation.x = 1.12; diskInner.rotation.y = 0.18; blackHole.add(diskInner);
    world.add(blackHole);
    // A thin photon-ring cue and faint outer lensing halo frame the shadow.
    // This is an artistic real-time approximation, not a ray-traced GR solver.
    const photonRing = new THREE.Mesh(new THREE.TorusGeometry(1.13, 0.035, 10, 120), new THREE.MeshBasicMaterial({ color: 0xf2e5ff, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending }));
    photonRing.rotation.x = 1.12; photonRing.rotation.y = 0.18; blackHole.add(photonRing);
    const lensingHalo = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.095, 8, 120), new THREE.MeshBasicMaterial({ color: 0x9275d8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending }));
    lensingHalo.rotation.x = 1.12; lensingHalo.rotation.y = 0.18; blackHole.add(lensingHalo);
    const plasmaMaterial = new THREE.MeshBasicMaterial({ color: 0xffd6ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending });
    const plasmaKnots = [];
    for (let i = 0; i < 5; i++) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055 + (i % 2) * 0.025, 10, 8), plasmaMaterial);
      blackHole.add(knot);
      plasmaKnots.push({ knot, angle: (i / 5) * Math.PI * 2, radius: 1.52 + (i % 2) * 0.16 });
    }

    // An asteroid belt uses instancing: many individually varied rocks at a
    // low draw-call cost, including on compact mobile GPUs.
    const asteroidBelt = new THREE.Group();
    asteroidBelt.position.set(-0.5, 0.2, -10.5);
    const asteroidCount = compact ? 52 : 104;
    const asteroidGeometry = new THREE.DodecahedronGeometry(0.12, 0);
    const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x8c829b, roughness: 0.96, metalness: 0.03 });
    const asteroids = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, asteroidCount);
    const asteroidDummy = new THREE.Object3D();
    for (let i = 0; i < asteroidCount; i++) {
      const angle = (i / asteroidCount) * Math.PI * 2 + Math.random() * 0.12;
      const radius = 4.7 + Math.random() * 2.15;
      asteroidDummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66 + (Math.random() - 0.5) * 0.36, (Math.random() - 0.5) * 0.48);
      asteroidDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const scale = 0.34 + Math.random() * 1.1;
      asteroidDummy.scale.set(scale, scale * (0.55 + Math.random() * 0.65), scale * (0.65 + Math.random() * 0.55));
      asteroidDummy.updateMatrix();
      asteroids.setMatrixAt(i, asteroidDummy.matrix);
    }
    asteroids.instanceMatrix.needsUpdate = true;
    asteroidBelt.add(asteroids);
    world.add(asteroidBelt);

    // A miniature solar system gives the eye a clear scale reference: a warm
    // star, distinct orbital planes and four worlds moving at different rates.
    const miniatureSystem = new THREE.Group();
    miniatureSystem.position.set(0.4, -0.9, -18.5);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.43, 28, 20), new THREE.MeshBasicMaterial({ color: 0xffd9a1 }));
    miniatureSystem.add(sun);
    const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffb76c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    miniatureSystem.add(sunHalo);
    const systemOrbits = [];
    const systemPlanetColors = [0xb8a6e8, 0x6f9bc4, 0xc68c76, 0x9c91bd];
    [1.0, 1.55, 2.25, 3.0].forEach((distance, i) => {
      const orbit = new THREE.Group();
      const track = new THREE.Mesh(new THREE.TorusGeometry(distance, 0.006, 5, 80), new THREE.MeshBasicMaterial({ color: 0xc5b2ed, transparent: true, opacity: 0.2 }));
      orbit.add(track);
      const planet = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.025, 16, 12), new THREE.MeshStandardMaterial({ color: systemPlanetColors[i], roughness: 0.8, metalness: 0.04 }));
      planet.position.x = distance;
      orbit.add(planet);
      miniatureSystem.add(orbit);
      systemOrbits.push({ orbit, speed: (i % 2 ? -1 : 1) * (0.0018 / (1 + i * 0.8)) });
    });
    world.add(miniatureSystem);

    // A comet crosses the scene on a long elliptical path with a layered tail.
    const comet = new THREE.Group();
    const cometHead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), new THREE.MeshStandardMaterial({ color: 0xd9e8ff, emissive: 0x7896d8, emissiveIntensity: 1.2, roughness: 0.35 }));
    comet.add(cometHead);
    const cometTail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 3.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.19, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    cometTail.rotation.z = Math.PI / 2;
    cometTail.position.x = 1.82;
    comet.add(cometTail);
    const cometInnerTail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 2.6, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8c9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    cometInnerTail.rotation.z = Math.PI / 2;
    cometInnerTail.position.x = 1.3;
    comet.add(cometInnerTail);
    comet.position.set(-8, 3.8, -8.5);
    world.add(comet);

    // A distant wormhole is built from nested, tilted energy rings rather than
    // a flat portal image, so it retains depth as the camera gently shifts.
    const wormhole = new THREE.Group();
    wormhole.position.set(-7.4, 4.0, -27);
    const wormholeCore = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), new THREE.MeshBasicMaterial({ color: 0x090713 }));
    wormhole.add(wormholeCore);
    const wormholeRings = [];
    [1.12, 1.38, 1.68].forEach((radius, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, i === 1 ? 0.045 : 0.022, 8, 96), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xa9b8ff : 0xb99aff, transparent: true, opacity: 0.42 - i * 0.07, blending: THREE.AdditiveBlending }));
      ring.rotation.set(0.42 + i * 0.24, 0.2 - i * 0.18, i * 0.36);
      wormhole.add(ring);
      wormholeRings.push(ring);
    });
    world.add(wormhole);

    // Meteor particles use a compact point buffer and recycle after each pass.
    const meteorCount = compact ? 18 : 36;
    const meteorPositions = new Float32Array(meteorCount * 3);
    const meteorVelocity = new Float32Array(meteorCount * 3);
    for (let i = 0; i < meteorCount; i++) {
      const o = i * 3;
      meteorPositions[o] = (Math.random() - 0.5) * 28;
      meteorPositions[o + 1] = (Math.random() - 0.5) * 18;
      meteorPositions[o + 2] = -Math.random() * 52;
      meteorVelocity[o] = -0.035 - Math.random() * 0.045;
      meteorVelocity[o + 1] = -0.018 - Math.random() * 0.025;
      meteorVelocity[o + 2] = 0.012 + Math.random() * 0.025;
    }
    const meteorGeometry = new THREE.BufferGeometry();
    meteorGeometry.setAttribute("position", new THREE.BufferAttribute(meteorPositions, 3));
    const meteors = new THREE.Points(meteorGeometry, new THREE.PointsMaterial({ color: 0xc8baff, size: compact ? 0.065 : 0.085, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(meteors);
    const meteorTrailPositions = new Float32Array(meteorCount * 6);
    const meteorTrailGeometry = new THREE.BufferGeometry();
    meteorTrailGeometry.setAttribute("position", new THREE.BufferAttribute(meteorTrailPositions, 3));
    const meteorTrails = new THREE.LineSegments(meteorTrailGeometry, new THREE.LineBasicMaterial({ color: 0xb9a7ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(meteorTrails);

    // A stream of near-field stars travels towards the viewer, creating
    // genuine forward movement rather than rotating a static star dome.
    const nearStarCount = compact ? 180 : 360;
    const nearStarPositions = new Float32Array(nearStarCount * 3);
    const nearStarSpeeds = new Float32Array(nearStarCount);
    for (let i = 0; i < nearStarCount; i++) {
      nearStarPositions[i * 3] = (Math.random() - 0.5) * 26;
      nearStarPositions[i * 3 + 1] = (Math.random() - 0.5) * 17;
      nearStarPositions[i * 3 + 2] = -Math.random() * 65;
      nearStarSpeeds[i] = 0.025 + Math.random() * 0.075;
    }
    const nearStarGeometry = new THREE.BufferGeometry();
    nearStarGeometry.setAttribute("position", new THREE.BufferAttribute(nearStarPositions, 3));
    const nearStars = new THREE.Points(nearStarGeometry, new THREE.PointsMaterial({ color: 0xdccfff, size: compact ? 0.045 : 0.06, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(nearStars);

    // Reuse scratch objects and initialize shader lighting before the first
    // render, including the reduced-motion path where the animation loop is idle.
    const keyLightWorldPosition = new THREE.Vector3();
    const objectWorldPosition = new THREE.Vector3();
    const inverseObjectWorldRotation = new THREE.Quaternion();
    const localLightDirection = new THREE.Vector3();
    const updatePlanetLightDirections = () => {
      keyLight.getWorldPosition(keyLightWorldPosition);
      planetLightBindings.forEach(({ object, material }) => {
        object.getWorldPosition(objectWorldPosition);
        object.getWorldQuaternion(inverseObjectWorldRotation).invert();
        localLightDirection.copy(keyLightWorldPosition).sub(objectWorldPosition).applyQuaternion(inverseObjectWorldRotation).normalize();
        material.uniforms.uLightDirection.value.copy(localLightDirection);
      });
    };
    updatePlanetLightDirections();

    const pointer = { x: 0, y: 0 };
    const frameInterval = 1000 / 30;
    let lastFrameTime = 0;
    const onPointer = (event) => {
      pointer.x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointer.y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };
    let pointerListening = !reduced;
    if (pointerListening) window.addEventListener("pointermove", onPointer, { passive: true });
    const resize = () => {
      // A lost WebGL context must not receive renderer sizing calls. The
      // restored-context handler flips this guard before applying the new size.
      if (!contextAvailable || !active) return;
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const onContextLost = (event) => {
      event.preventDefault();
      contextAvailable = false;
      canvas.dataset.webglFallback = "true";
      stop();
    };
    const onContextRestored = () => {
      contextAvailable = true;
      delete canvas.dataset.webglFallback;
      resize();
      start();
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);
    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    // Keep the canvas correctly sized in browsers without ResizeObserver too.
    window.addEventListener("resize", resize, { passive: true });

    const draw = (time) => {
      if (!active || !inView || document.hidden || !contextAvailable) return;
      raf = window.requestAnimationFrame(draw);
      if (time - lastFrameTime < frameInterval) return;
      const delta = lastFrameTime ? Math.min(50, time - lastFrameTime) / 16.667 : 1;
      lastFrameTime = time;
      if (!reduced) {
        nebulaMaterial.uniforms.uTime.value = time;
        stars.rotation.y += 0.000035 * delta;
        stars.rotation.x += 0.000012 * delta;
        planets.forEach((planet, i) => { planet.rotation.y += (i === 0 ? 0.00055 : 0.0008) * delta; planet.rotation.x += 0.00008 * delta; });
        cloudLayers.forEach((cloud) => { cloud.rotation.y += 0.00068 * delta; cloud.rotation.x += 0.000035 * delta; });
        travellers.forEach((traveller) => {
          const { object, phase, x, y, z, rangeX, rangeY, rangeZ, speed } = traveller;
          const t = time * speed + phase;
          object.position.x = x + Math.sin(t * 0.72) * rangeX;
          object.position.y = y + Math.sin(t * 1.13) * rangeY;
          object.position.z = z + ((t * 0.42) % rangeZ);
          if (object.position.z > 5) object.position.z -= rangeZ;
          object.rotation.y += 0.0018 * delta;
          object.rotation.z += Math.sin(t * 0.8) * 0.0007 * delta;
        });
        blackHole.rotation.z += 0.00018 * delta;
        plasmaKnots.forEach(({ knot, angle, radius }) => {
          const a = angle + time * 0.00022;
          knot.position.set(Math.cos(a) * radius, Math.sin(a) * radius * 0.32, Math.sin(a) * radius * 0.88);
        });
        moonOrbits.forEach(({ orbit, speed }) => { orbit.rotation.z += speed * delta; });
        systemOrbits.forEach(({ orbit, speed }) => { orbit.rotation.z += speed * delta; });
        miniatureSystem.rotation.y += 0.00012 * delta;
        asteroidBelt.rotation.y += 0.00016 * delta;
        asteroidBelt.rotation.z += 0.000035 * delta;
        comet.position.x = -8 + Math.sin(time * 0.00011) * 5.2;
        comet.position.y = 3.8 - Math.cos(time * 0.00014) * 2.4;
        comet.rotation.z = Math.sin(time * 0.00008) * 0.12;
        wormhole.rotation.z += 0.00013 * delta;
        wormholeRings.forEach((ring, i) => { ring.rotation.z += (i % 2 ? -1 : 1) * 0.00024 * delta; });
        const meteorArray = meteorGeometry.attributes.position.array;
        for (let i = 0; i < meteorCount; i++) {
          const o = i * 3;
          meteorArray[o] += meteorVelocity[o] * delta;
          meteorArray[o + 1] += meteorVelocity[o + 1] * delta;
          meteorArray[o + 2] += meteorVelocity[o + 2] * delta;
          if (meteorArray[o] < -15 || meteorArray[o + 1] < -10 || meteorArray[o + 2] > 7) {
            meteorArray[o] = 12 + Math.random() * 5;
            meteorArray[o + 1] = 5 + Math.random() * 6;
            meteorArray[o + 2] = -35 - Math.random() * 22;
          }
        }
        meteorGeometry.attributes.position.needsUpdate = true;
        const trailArray = meteorTrailGeometry.attributes.position.array;
        for (let i = 0; i < meteorCount; i++) {
          const o = i * 3, t = i * 6;
          trailArray[t] = meteorArray[o] - meteorVelocity[o] * 5;
          trailArray[t + 1] = meteorArray[o + 1] - meteorVelocity[o + 1] * 5;
          trailArray[t + 2] = meteorArray[o + 2] - meteorVelocity[o + 2] * 5;
          trailArray[t + 3] = meteorArray[o];
          trailArray[t + 4] = meteorArray[o + 1];
          trailArray[t + 5] = meteorArray[o + 2];
        }
        meteorTrailGeometry.attributes.position.needsUpdate = true;
        const nearPositions = nearStarGeometry.attributes.position.array;
        for (let i = 0; i < nearStarCount; i++) {
          const offset = i * 3;
          nearPositions[offset + 2] += nearStarSpeeds[i] * delta;
          if (nearPositions[offset + 2] > 9) {
            nearPositions[offset] = (Math.random() - 0.5) * 26;
            nearPositions[offset + 1] = (Math.random() - 0.5) * 17;
            nearPositions[offset + 2] = -65 - Math.random() * 12;
          }
        }
        nearStarGeometry.attributes.position.needsUpdate = true;
        updatePlanetLightDirections();
        const easing = 1 - Math.pow(1 - 0.012, delta);
        camera.position.x += (pointer.x * 0.28 - camera.position.x) * easing;
        camera.position.y += (-pointer.y * 0.18 - camera.position.y) * easing;
        camera.lookAt(0, 0, -2.6);
      }
      renderer.render(scene, camera);
    };
    const start = () => {
      if (!active || !inView || document.hidden || !contextAvailable) return;
      if (reduced) renderer.render(scene, camera);
      else if (!raf) {
        lastFrameTime = 0;
        raf = window.requestAnimationFrame(draw);
      }
    };
    const stop = () => { if (raf) window.cancelAnimationFrame(raf); raf = 0; };
    const onMotionPreferenceChange = (event) => {
      reduced = event.matches;
      if (reduced && pointerListening) {
        window.removeEventListener("pointermove", onPointer);
        pointerListening = false;
      } else if (!reduced && !pointerListening) {
        window.addEventListener("pointermove", onPointer, { passive: true });
        pointerListening = true;
      }
      stop();
      start();
    };
    motionQuery?.addEventListener?.("change", onMotionPreferenceChange);
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibility);
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) start(); else stop(); }, { threshold: 0.01 });
      observer.observe(canvas);
    }
    start();
    return () => {
      active = false; stop();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery?.removeEventListener?.("change", onMotionPreferenceChange);
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener("webglcontextrestored", onContextRestored, false);
      if (pointerListening) window.removeEventListener("pointermove", onPointer);
      resizeObserver?.disconnect(); observer?.disconnect();
      window.removeEventListener("resize", resize);
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        materials.forEach((material) => {
          material.map?.dispose?.();
          material.bumpMap?.dispose?.();
          material.roughnessMap?.dispose?.();
          material.dispose?.();
        });
      });
      renderer.dispose();
    };
  }, []);
  return <canvas ref={canvasRef} className="universe-webgl" aria-hidden="true" />;
}
