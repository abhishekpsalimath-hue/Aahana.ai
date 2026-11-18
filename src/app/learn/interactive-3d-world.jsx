"use client";

import { useEffect, useRef, useState } from "react";

import * as THREE from "three";
import worldTopology from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";

const threeScenes = new WeakMap();

function makeEarthTexture() {
  // Natural Earth 1:110m country boundaries provide real global geography,
  // rather than hand-drawn continent approximations.
  const canvas = document.createElement("canvas");
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#071b3a");
  ocean.addColorStop(.48, "#07547b");
  ocean.addColorStop(1, "#061b38");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const project = ([longitude, latitude]) => [
    ((longitude + 180) / 360) * canvas.width,
    ((90 - latitude) / 180) * canvas.height,
  ];
  const drawRing = (ring) => {
    if (!ring?.length) return;
    ctx.beginPath();
    ring.forEach((coordinate, index) => {
      const [x, y] = project(coordinate);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  const drawGeometry = (geometry) => {
    if (!geometry) return;
    const polygons = geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    polygons.forEach((polygon) => {
      polygon.forEach((ring, ringIndex) => {
        ctx.fillStyle = ringIndex === 0 ? "#648b62" : ocean;
        ctx.strokeStyle = "#a9bd91";
        ctx.lineWidth = ringIndex === 0 ? 1.25 : .6;
        drawRing(ring);
      });
    });
  };

  const countries = feature(worldTopology, worldTopology.objects.countries);
  countries.features.forEach(({ geometry }) => drawGeometry(geometry));

  // Polar ice is shown as a latitude band, not as invented continent shapes.
  const ice = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ice.addColorStop(0, "rgba(226,239,239,.94)");
  ice.addColorStop(.09, "rgba(226,239,239,.72)");
  ice.addColorStop(.13, "rgba(226,239,239,0)");
  ice.addColorStop(.87, "rgba(226,239,239,0)");
  ice.addColorStop(.91, "rgba(226,239,239,.72)");
  ice.addColorStop(1, "rgba(226,239,239,.94)");
  ctx.fillStyle = ice;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
const solarPlanets = [
  { id: "mercury", label: "Mercury", distance: .78, radius: .065, color: "#8f8b85", family: "Rocky planet", diameter: "4,879 km", orbit: "0.39 AU", description: "The smallest planet and the closest to the Sun. Its ancient surface is heavily cratered, and it has almost no atmosphere." },
  { id: "venus", label: "Venus", distance: 1.08, radius: .105, color: "#d8b878", family: "Terrestrial planet", diameter: "12,104 km", orbit: "0.72 AU", description: "A rocky world wrapped in thick clouds. Its intense greenhouse effect makes it the hottest planet in our Solar System." },
  { id: "earth", label: "Earth", distance: 1.43, radius: .115, color: "#428bd1", family: "Terrestrial planet", diameter: "12,742 km", orbit: "1.00 AU", description: "Our ocean-rich home, with a nitrogen- and oxygen-rich atmosphere and the only confirmed life known to us." },
  { id: "mars", label: "Mars", distance: 1.78, radius: .085, color: "#bd684e", family: "Terrestrial planet", diameter: "6,779 km", orbit: "1.52 AU", description: "A cold, dusty rocky world with giant volcanoes, ancient river-shaped landscapes and two small moons." },
  { id: "jupiter", label: "Jupiter", distance: 2.23, radius: .27, color: "#d1ad86", family: "Gas giant", diameter: "139,820 km", orbit: "5.20 AU", description: "The largest planet. Its atmosphere contains broad cloud bands and the long-lived Great Red Spot." },
  { id: "saturn", label: "Saturn", distance: 2.72, radius: .23, color: "#d9c69b", family: "Gas giant", diameter: "116,460 km", orbit: "9.58 AU", description: "A gas giant famous for its broad, bright rings made mostly of countless pieces of water ice and rock." },
  { id: "uranus", label: "Uranus", distance: 3.18, radius: .17, color: "#91d3d6", family: "Ice giant", diameter: "50,724 km", orbit: "19.2 AU", description: "An ice giant with a blue-green atmosphere and an extreme axial tilt, making it appear to rotate on its side." },
  { id: "neptune", label: "Neptune", distance: 3.62, radius: .17, color: "#477bd7", family: "Ice giant", diameter: "49,244 km", orbit: "30.05 AU", description: "A distant ice giant with a deep blue atmosphere and some of the fastest winds measured on any planet." },
];

function makePlanetTexture(planetId) {
  if (planetId === "earth") return makeEarthTexture();
  const planet = solarPlanets.find((item) => item.id === planetId) || solarPlanets[0];
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  const base = new THREE.Color(planet.color);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, base.clone().multiplyScalar(1.35).getStyle());
  gradient.addColorStop(.5, base.getStyle());
  gradient.addColorStop(1, base.clone().multiplyScalar(.52).getStyle());
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (["jupiter", "saturn", "uranus", "neptune", "venus"].includes(planetId)) {
    const bandCount = planetId === "jupiter" ? 34 : planetId === "saturn" ? 24 : 18;
    for (let i = 0; i < bandCount; i++) {
      const y = (i / bandCount) * canvas.height;
      const wave = Math.sin(i * 1.7) * 13 + Math.cos(i * .63) * 8;
      const alpha = .08 + ((i * 7) % 5) * .025;
      ctx.fillStyle = i % 2 ? `rgba(255,244,218,${alpha})` : `rgba(42,54,86,${alpha})`;
      ctx.fillRect(0, y + wave, canvas.width, canvas.height / bandCount * (.42 + (i % 3) * .12));
    }
    if (planetId === "jupiter") {
      ctx.fillStyle = "rgba(166,73,48,.78)";
      ctx.beginPath(); ctx.ellipse(980, 420, 95, 42, -.12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,224,190,.34)"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(980, 420, 112, 51, -.12, 0, Math.PI * 2); ctx.stroke();
    }
    if (planetId === "venus") {
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(255,247,219,${.07 + (i % 4) * .025})`;
        ctx.lineWidth = 18 + (i % 5) * 9;
        ctx.beginPath(); ctx.moveTo(-80, i * 48); ctx.bezierCurveTo(360, i * 42 + 65, 980, i * 48 - 55, 1610, i * 48 + 24); ctx.stroke();
      }
    }
  }

  if (["mercury", "mars"].includes(planetId)) {
    for (let i = 0; i < 95; i++) {
      const x = (i * 197 + 83) % canvas.width;
      const y = (i * 113 + 41) % canvas.height;
      const radius = 5 + (i * 17) % (planetId === "mars" ? 25 : 31);
      ctx.fillStyle = planetId === "mars" ? "rgba(74,37,32,.2)" : "rgba(34,36,42,.22)";
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,226,197,.12)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x - 2, y - 2, radius * .82, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addPlanetAtmosphere(group, radius, color, opacity = .13) {
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.055, 64, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(atmosphere);
  return atmosphere;
}

function createFocusedPlanet(group, planet) {
  const radius = 1.18;
  const material = new THREE.MeshStandardMaterial({ map: makePlanetTexture(planet.id), roughness: planet.id === "venus" ? .68 : .82, metalness: .015 });
  const body = sphere(group, [0, 0, 0], radius, 0xffffff, { material, segments: 96 });
  body.userData.planetId = planet.id;
  addPlanetAtmosphere(group, radius, planet.id === "earth" ? 0x63b9ff : planet.id === "venus" ? 0xe7c17b : planet.id === "neptune" ? 0x3679ff : 0x9bb6d8, planet.id === "earth" ? .22 : .11);

  if (planet.id === "earth") {
    sphere(group, [0, 0, 0], radius * 1.009, 0xffffff, {
      material: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .09, roughness: 1, wireframe: true, depthWrite: false }),
      segments: 72,
    });
    const moonOrbit = new THREE.Mesh(new THREE.TorusGeometry(1.62, .006, 8, 160), new THREE.MeshBasicMaterial({ color: 0x9bbce7, transparent: true, opacity: .26 }));
    moonOrbit.rotation.x = Math.PI / 2.4; group.add(moonOrbit);
    const moon = sphere(group, [1.62, .1, 0], .16, 0xc9cbd0, { roughness: .95 });
    moon.userData.isMoon = true;
  }

  if (planet.id === "saturn" || planet.id === "uranus") {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(planet.id === "saturn" ? 1.48 : 1.42, planet.id === "saturn" ? 2.05 : 1.72, 160),
      new THREE.MeshStandardMaterial({ color: planet.id === "saturn" ? 0xd8c7a3 : 0x9ac9d0, side: THREE.DoubleSide, transparent: true, opacity: .78, roughness: .88 })
    );
    ring.rotation.x = Math.PI / 2.35;
    group.add(ring);
    if (planet.id === "saturn") {
      const gap = new THREE.Mesh(new THREE.RingGeometry(1.69, 1.73, 160), new THREE.MeshBasicMaterial({ color: 0x28283a, side: THREE.DoubleSide }));
      gap.rotation.copy(ring.rotation); group.add(gap);
    }
  }
  if (planet.id === "jupiter") {
    const storm = sphere(group, [.28, .16, 1.14], .105, 0xb85d43, { segments: 24, roughness: .85 });
    storm.scale.set(1.35, .58, .2);
  }
}

function addStars(scene) {
  const positions = new Float32Array(2200 * 3);
  for (let i = 0; i < 2200; i++) {
    const radius = 18 + Math.random() * 34;
    const angle = Math.random() * Math.PI * 2;
    const vertical = Math.random() * 2 - 1;
    const spread = Math.sqrt(1 - vertical * vertical);
    positions[i * 3] = radius * spread * Math.cos(angle);
    positions[i * 3 + 1] = radius * vertical;
    positions[i * 3 + 2] = radius * spread * Math.sin(angle);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xd7e7ff, size: .085, transparent: true, opacity: .9, sizeAttenuation: true });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

function sphere(group, position, radius, color, options={}) {
  const geometry=new THREE.SphereGeometry(radius,options.segments||48,options.segments||32);
  const material=options.material||new THREE.MeshStandardMaterial({color,roughness:options.roughness??.48,metalness:options.metalness??.02});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function tube(group, points, color, radius=.025, opacity=1) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*8),radius,10,false),new THREE.MeshStandardMaterial({color,roughness:.4,transparent:opacity<1,opacity}));
  group.add(mesh);return mesh;
}
function rod(group,a,b,color=0xb9c8e2,radius=.035) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=new THREE.Vector3().subVectors(end,start);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),20),new THREE.MeshStandardMaterial({color,metalness:.45,roughness:.28}));
  mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(mesh);return mesh;
}
function makeSceneModel(group,id,selectedPlanet=null,heartFlow="body",labState={}) {
  if(id==="planet"){
    const earth=sphere(group,[0,0,0],1,"#ffffff",{material:new THREE.MeshStandardMaterial({map:makeEarthTexture(),roughness:.86})});
    const clouds=sphere(group,[0,0,0],1.008,"#ffffff",{material:new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.13,roughness:1,wireframe:true})});
    const atmosphere=sphere(group,[0,0,0],1.045,"#4aa8ff",{material:new THREE.MeshBasicMaterial({color:0x4baaff,transparent:true,opacity:.09,side:THREE.BackSide})});
    const axis=new THREE.Group();axis.rotation.z=.34;group.add(axis);
    const line=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,2.65,12),new THREE.MeshBasicMaterial({color:0xb8d7ff,transparent:true,opacity:.48}));axis.add(line);
    const pole=sphere(axis,[0,1.32,0],.035,0xddeeff);sphere(axis,[0,-1.32,0],.035,0xddeeff);
    return;
  }
  if (id === "solar-system") {
    if (selectedPlanet) {
      const planet = solarPlanets.find((item) => item.id === selectedPlanet);
      if (planet) createFocusedPlanet(group, planet);
      return;
    }

    const sun = sphere(group, [0, 0, 0], .38, 0xffc45c, {
      material: new THREE.MeshStandardMaterial({ color: 0xffd16a, emissive: 0xff7a18, emissiveIntensity: 2.1, roughness: .5 }),
      segments: 72,
    });
    sun.userData.isSunCore = true;
    [0.48, .59, .72].forEach((radius, index) => {
      const glow = sphere(group, [0, 0, 0], radius, 0xffa83b, {
        material: new THREE.MeshBasicMaterial({ color: index === 0 ? 0xffc56d : 0xff8a35, transparent: true, opacity: .12 - index * .025, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
        segments: 48,
      });
      glow.userData.isSunGlow = true;
    });

    solarPlanets.forEach((planet, index) => {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(planet.distance, .004, 6, 220),
        new THREE.MeshBasicMaterial({ color: 0x8ea5cf, transparent: true, opacity: .24, depthWrite: false })
      );
      orbit.rotation.x = Math.PI / 2;
      group.add(orbit);

      const pivot = new THREE.Group();
      pivot.userData.orbitSpeed = .000035 + (7 - index) * .000004;
      pivot.userData.orbitPhase = index * .47;
      group.add(pivot);
      const body = sphere(pivot, [planet.distance, 0, 0], planet.radius, 0xffffff, {
        material: new THREE.MeshStandardMaterial({ map: makePlanetTexture(planet.id), roughness: .82, metalness: .01 }),
        segments: 48,
      });
      body.userData.planetId = planet.id;
      if (planet.id === "saturn" || planet.id === "uranus") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(planet.radius * 1.28, planet.radius * (planet.id === "saturn" ? 2.0 : 1.65), 80),
          new THREE.MeshStandardMaterial({ color: planet.id === "saturn" ? 0xd7c59e : 0x8bc5d0, side: THREE.DoubleSide, transparent: true, opacity: .76, roughness: .9 })
        );
        ring.position.set(planet.distance, 0, 0);
        ring.rotation.set(Math.PI / 2.3, 0, .08);
        pivot.add(ring);
      }
    });
    return;
  }
  if(id==="molecule"){
    const kind=labState.chemistryMolecule||"water";
    const focus=labState.chemistryFocus||"all";
    const definitions={
      water:{atoms:[{p:[0,.08,0],r:.36,c:0xe66b78,role:"oxygen"},{p:[-.68,-.43,.12],r:.23,c:0xe9edf7,role:"hydrogen"},{p:[.68,-.43,.12],r:.23,c:0xe9edf7,role:"hydrogen"}],bonds:[[0,1],[0,2]]},
      carbonDioxide:{atoms:[{p:[-.9,0,0],r:.27,c:0xe66b78,role:"oxygen"},{p:[0,0,0],r:.31,c:0x737b8d,role:"carbon"},{p:[.9,0,0],r:.27,c:0xe66b78,role:"oxygen"}],bonds:[[0,1],[1,2]]},
      methane:{atoms:[{p:[0,0,0],r:.32,c:0x737b8d,role:"carbon"},{p:[.72,.55,.55],r:.2,c:0xe9edf7,role:"hydrogen"},{p:[-.72,.55,-.55],r:.2,c:0xe9edf7,role:"hydrogen"},{p:[.55,-.65,-.55],r:.2,c:0xe9edf7,role:"hydrogen"},{p:[-.55,-.65,.55],r:.2,c:0xe9edf7,role:"hydrogen"}],bonds:[[0,1],[0,2],[0,3],[0,4]]},
      ammonia:{atoms:[{p:[0,.12,0],r:.34,c:0x7298dc,role:"nitrogen"},{p:[.72,-.38,.18],r:.2,c:0xe9edf7,role:"hydrogen"},{p:[-.66,-.42,.22],r:.2,c:0xe9edf7,role:"hydrogen"},{p:[0,-.48,-.72],r:.2,c:0xe9edf7,role:"hydrogen"}],bonds:[[0,1],[0,2],[0,3]]},
    };
    const molecule=definitions[kind]||definitions.water;
    if(labState.chemistryShowBonds!==false) molecule.bonds.forEach(([a,b])=>rod(group,molecule.atoms[a].p,molecule.atoms[b].p,0xb9c8e2,.035));
    molecule.atoms.forEach(atom=>sphere(group,atom.p,atom.r,focus==="all"||focus===atom.role?atom.c:0x4a5060,{roughness:.24,metalness:.03}));
    return;
  }
  if(id==="atom"){
    [[-.14,0,0],[.12,.12,.04],[.12,-.12,-.06],[0,.08,.15],[0,-.12,.12]].forEach((p,i)=>sphere(group,p,.18,i%2?0xe88c79:0xb88be5));
    for(let i=0;i<3;i++){const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.12,.009,8,100),new THREE.MeshBasicMaterial({color:0x8bcdf5,transparent:true,opacity:.7}));orbit.rotation.set(i*.9,i*1.1,i*.7);group.add(orbit);const e=sphere(group,[Math.cos(i*2.1)*1.12,Math.sin(i*2.1)*.6,Math.sin(i*2.1)*.4],.055,0xc5efff);e.material.emissive.set(0x64bfff);e.material.emissiveIntensity=.8;}return;
  }
  if(id==="dna"){
    // B-DNA teaching geometry: about 10 base pairs per turn and 3.4 Å
    // axial rise per base pair. Dimensions are uniformly enlarged for viewing.
    const left=[],right=[];
    const basePairs=20;
    const radius=.48;
    const heightPerTurn=1.7;
    const totalHeight=heightPerTurn*(basePairs/10);
    for(let i=0;i<=200;i++){
      const fraction=i/200;
      const t=fraction*Math.PI*4;
      const y=(fraction-.5)*totalHeight;
      left.push([Math.cos(t)*radius,y,Math.sin(t)*radius]);
      right.push([Math.cos(t+Math.PI)*radius,y,Math.sin(t+Math.PI)*radius]);
    }
    tube(group,left,0x69d6b1,.035);
    tube(group,right,0x9e8be9,.035);
    for(let i=0;i<basePairs;i++){
      const t=(i/basePairs)*Math.PI*4;
      const y=(i/(basePairs-1)-.5)*totalHeight;
      const a=[Math.cos(t)*radius,y,Math.sin(t)*radius];
      const b=[Math.cos(t+Math.PI)*radius,y,Math.sin(t+Math.PI)*radius];
      rod(group,a,b,i%2?0xf0c66d:0x8dc8ee,.018);
    }
    return;
  }
  if(id==="cell"||id==="plant-cell"){
    const plant=id==="plant-cell";
    const focus=labState.cellFocus||"all";
    const active=(role)=>focus==="all"||focus===role;
    const muted=0x4c5260;
    if(plant){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(2.05,1.45,1.45),new THREE.MeshStandardMaterial({color:active("cellWall")?0x9dcc88:muted,wireframe:true,transparent:true,opacity:.82}));
      group.add(wall);
      sphere(group,[0,0,0],.88,0x76b9d9,{material:new THREE.MeshPhysicalMaterial({color:0x76b9d9,transparent:true,opacity:active("vacuole")?.35:.12,roughness:.2,transmission:.18,thickness:.3})});
      sphere(group,[-.55,.28,.18],.16,active("nucleus")?0x9b75c8:muted);
      [[.48,.36,-.22],[-.48,-.35,-.18],[.5,-.3,.22]].forEach(p=>sphere(group,p,.14,active("chloroplasts")?0x77bd79:muted));
      sphere(group,[-.05,.52,-.3],.1,active("mitochondria")?0xe7c36e:muted);
    } else {
      sphere(group,[0,0,0],.98,0x62b8c1,{material:new THREE.MeshPhysicalMaterial({color:active("membrane")?0x67c5c0:muted,transparent:true,opacity:.18,roughness:.2,transmission:.2,thickness:.35,side:THREE.DoubleSide})});
      sphere(group,[0,.08,.08],.34,active("nucleus")?0xbd83d7:muted);
      [[-.48,-.2,.12],[.46,.28,-.18]].forEach(p=>sphere(group,p,.15,active("mitochondria")?0xe9b66c:muted));
      const erColor=active("endoplasmicReticulum")?0x77c69e:muted;
      tube(group,[[-.36,-.48,.22],[-.05,-.55,.3],[.22,-.42,.3],[.35,-.2,.25]],erColor,.035);
      tube(group,[[-.36,.4,-.22],[-.1,.5,-.28],[.18,.43,-.25]],erColor,.03);
      [[.52,-.2,.18],[-.48,.28,-.2],[.32,.52,.1],[-.58,-.35,-.12]].forEach(p=>sphere(group,p,.055,active("ribosomes")?0xe6d28a:muted));
    }
    return;
  }
  if(id==="heart"){
    const stageColors = {
      body: [0x477fba, 0x477fba, 0x477fba, 0x477fba],
      lungs: [0x477fba, 0x477fba, 0xc95e78, 0xc95e78],
      return: [0xc95e78, 0xc95e78, 0xc95e78, 0xc95e78],
    };
    const colors = stageColors[heartFlow] || stageColors.body;
    sphere(group,[-.28,.1,0],.43,colors[0]);sphere(group,[.25,.1,0],.43,colors[1]);sphere(group,[-.16,-.35,.04],.38,colors[2]);sphere(group,[.22,-.35,.04],.38,colors[3]);
    tube(group,[[.05,.48,0],[.1,.82,0],[.32,1.02,0]],heartFlow==="lungs"?0xc95e78:0xc85b65,.105);
    tube(group,[[-.25,.4,0],[-.38,.75,0],[-.55,.9,0]],0x477fba,.09);
    tube(group,[[.2,.15,.18],[.55,.42,.18],[.62,.72,.18]],heartFlow==="return"?0x477fba:0xc96a62,.065);return;
  }
  if(id==="terrain"){
    const n=72,positions=[],colors=[],indices=[];
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=(x/n-.5)*3.2,pz=(z/n-.5)*3.2;const peak=Math.exp(-((px-.55)**2+(pz+.2)**2)*2.4)*.95+Math.exp(-((px+.7)**2+(pz-.55)**2)*3)*.52;const h=peak+.08*Math.sin(px*5)*Math.cos(pz*4);positions.push(px,h,pz);const c=new THREE.Color().setHSL(.28-h*.12,.34,.32+h*.2);colors.push(c.r,c.g,c.b);if(x<n&&z<n){const a=z*(n+1)+x,b=a+1,c1=a+n+1,d=c1+1;indices.push(a,c1,b,b,c1,d);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();group.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide})));return;
  }
  if(id==="cube"||id==="pyramid"){
    const mesh=id==="cube"?new THREE.Mesh(new THREE.BoxGeometry(1.45,1.45,1.45),new THREE.MeshStandardMaterial({color:0x9a83cf,roughness:.34,metalness:.12})):new THREE.Mesh(new THREE.ConeGeometry(1.05,1.55,4),new THREE.MeshStandardMaterial({color:0xc69c69,roughness:.8,flatShading:true}));mesh.rotation.y=Math.PI/4;group.add(mesh);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0xf0e6ff,transparent:true,opacity:.8}));edges.rotation.copy(mesh.rotation);group.add(edges);return;
  }
  if(id==="ecosystem"){
    const ground=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.65,.18,64),new THREE.MeshStandardMaterial({color:0x456e4a,roughness:1}));ground.position.y=-.65;group.add(ground);
    for(let i=0;i<12;i++){const a=i*2.4,r=.35+(i%4)*.25,x=Math.cos(a)*r,z=Math.sin(a)*r;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.045,.07,.55,8),new THREE.MeshStandardMaterial({color:0x76523b}));trunk.position.set(x,-.32,z);group.add(trunk);const crown=sphere(group,[x,.1+(i%3)*.12,z],.27+(i%3)*.035,i%2?0x3d8756:0x65985b);crown.scale.y=1.2;}return;
  }
  if(id==="engine"){
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,1.25,48,1,true),new THREE.MeshStandardMaterial({color:0x9aa8bc,metalness:.72,roughness:.3,side:THREE.DoubleSide}));cylinder.position.y=.15;group.add(cylinder);
    const piston=new THREE.Mesh(new THREE.CylinderGeometry(.255,.255,.13,48),new THREE.MeshStandardMaterial({color:0xc5ceda,metalness:.8,roughness:.22}));piston.position.y=.42;group.add(piston);
    rod(group,[0,.35,0],[.48,-.52,0],0xe0ad66,.065);
    const crank=new THREE.Mesh(new THREE.TorusGeometry(.52,.045,12,64),new THREE.MeshStandardMaterial({color:0x8c9bad,metalness:.8,roughness:.24}));crank.position.y=-.58;group.add(crank);return;
  }
  if(id==="cart"){
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(1.45,.16,.55),new THREE.MeshStandardMaterial({color:0xd38d51,metalness:.25,roughness:.38}));chassis.position.y=.18;group.add(chassis);
    for(const x of [-.48,.48]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.13,32),new THREE.MeshStandardMaterial({color:0x242735,roughness:.8}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.08,.32);group.add(wheel);const hub=sphere(group,[x,-.08,.4],.075,0xb7c3d4);}
    const push=tube(group,[[-1.05,.3,0],[-.82,.3,0],[-.68,.3,0]],0xf2cf83,.025);return;
  }
  if(id==="bridge"){
    // Simplified steel truss bridge: deck, supports, cross-bracing and tension members.
    const steel=new THREE.MeshStandardMaterial({color:0x8da8c5,metalness:.72,roughness:.3});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(3.35,.12,.62),new THREE.MeshStandardMaterial({color:0x65778f,metalness:.35,roughness:.55}));
    deck.position.y=-.42;group.add(deck);
    for(const x of [-1.28,1.28]){
      const tower=new THREE.Mesh(new THREE.BoxGeometry(.12,1.42,.12),steel);tower.position.set(x,.23,0);group.add(tower);
      rod(group,[x,-.34,-.29],[x,.92,-.29],0xb8cbe0,.035);
      rod(group,[x,-.34,.29],[x,.92,.29],0xb8cbe0,.035);
    }
    for(let i=0;i<8;i++){
      const x=-1.42+i*.405;
      rod(group,[x,-.34,-.29],[x+.405,.52,-.29],0x78c7dc,.025);
      rod(group,[x,-.34,.29],[x+.405,.52,.29],0x78c7dc,.025);
      rod(group,[x,-.34,-.29],[x+.405,-.34,-.29],0x9bb1ca,.022);
      rod(group,[x,-.34,.29],[x+.405,-.34,.29],0x9bb1ca,.022);
    }
    rod(group,[-1.55,.92,-.29],[1.55,.92,-.29],0xc4d4e7,.04);
    rod(group,[-1.55,.92,.29],[1.55,.92,.29],0xc4d4e7,.04);
    for(const x of [-1.28,-.86,-.43,0,.43,.86,1.28]){
      rod(group,[x,.88,-.29],[x,-.34,-.29],0x78c7dc,.018);
      rod(group,[x,.88,.29],[x,-.34,.29],0x78c7dc,.018);
    }
    return;
  }
}
function createThreeScene(canvas,id,selectedPlanet=null,heartFlow="body",labState={}) {
  let renderer;
  try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"low-power"}); }
  catch { return null; }
  const compactDevice = (window.matchMedia?.("(max-width: 760px)")?.matches)
    || (navigator.hardwareConcurrency || 8) <= 4
    || (navigator.deviceMemory || 8) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactDevice ? 1.35 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !compactDevice;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d19);
  scene.fog = new THREE.FogExp2(0x090d19, 0.0085);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(0, 0, 5.8);

  // Three-point documentary lighting: warm key, cool fill and a clean rim.
  scene.add(new THREE.HemisphereLight(0xc7ddff, 0x171321, 1.65));
  const key = new THREE.DirectionalLight(0xffe6c8, 3.15);
  key.position.set(-3.5, 4.5, 5);
  key.castShadow = !compactDevice;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 24;
  key.shadow.bias = -.00018;
  key.shadow.normalBias = .025;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8dbbff, 1.05);
  fill.position.set(4, 1.5, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8b91ff, 2.25);
  rim.position.set(4, -2, -4);
  scene.add(rim);
  const accent = new THREE.PointLight(0x6f9fff, .7, 18, 2);
  accent.position.set(-4, -1, 3);
  scene.add(accent);
  const stars = addStars(scene);
  const group = new THREE.Group();
  scene.add(group);
  makeSceneModel(group, id, selectedPlanet, heartFlow, labState);
  const state = { renderer, scene, camera, group, id, selectedPlanet, stars, width: 0, height: 0 };
  threeScenes.set(canvas,state);return state;
}
function clearSceneGroup(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{material.map?.dispose();material.dispose();});}
  });
}
function renderThreeScene(canvas, id, yaw, pitch, zoom, time = 0, selectedPlanet = null, orbitSpeedMultiplier = 1, heartFlow = "body", labState = {}) {
  let state = threeScenes.get(canvas);
  if (!state) {
    state = createThreeScene(canvas, id, selectedPlanet, heartFlow, labState);
    if (!state) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#d8c8f1";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("3D preview is unavailable on this device", canvas.width / 2, canvas.height / 2);
      }
      return;
    }
  }
  const labModelKey = id === "molecule" ? JSON.stringify([labState.chemistryMolecule, labState.chemistryFocus, labState.chemistryShowBonds]) : (id === "cell" || id === "plant-cell") ? String(labState.cellFocus || "all") : id === "heart" ? String(heartFlow) : "";
  if (state.id !== id || state.selectedPlanet !== selectedPlanet || state.labModelKey !== labModelKey) {
    state.scene.remove(state.group);
    clearSceneGroup(state.group);
    state.group = new THREE.Group();
    state.scene.add(state.group);
    state.id = id;
    state.selectedPlanet = selectedPlanet;
    state.heartFlow = heartFlow;
    makeSceneModel(state.group, id, selectedPlanet, heartFlow);
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (width !== state.width || height !== state.height) {
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.width = width;
    state.height = height;
  }

  state.group.rotation.set(pitch, yaw + (id === "solar-system" ? time * .000025 : time * .000012), 0);
  state.stars.rotation.y = time * .000008;
  // A very restrained moving accent keeps the scene alive without distracting
  // from the concept or changing the learner's camera orientation.
  const accentLight = state.scene.children.find((child) => child.isPointLight);
  if (accentLight) {
    accentLight.position.x = -4 + Math.sin(time * .00022) * .65;
    accentLight.position.y = -1 + Math.cos(time * .00018) * .35;
    accentLight.intensity = .62 + Math.sin(time * .0007) * .08;
  }
  state.group.children.forEach((child) => {
    if (typeof child.userData?.orbitSpeed === "number") {
      child.rotation.y = time * child.userData.orbitSpeed * orbitSpeedMultiplier + child.userData.orbitPhase;
    }
    if (child.userData?.isSunCore) {
      const pulse = 1 + Math.sin(time * .0015) * .035;
      child.scale.setScalar(pulse);
    }
  });

  const baseCamera = id === "solar-system"
    ? selectedPlanet ? 4.25 : Math.max(5.8, 11.8 / Math.max(state.camera.aspect, .65))
    : 5.8;
  state.camera.position.z = baseCamera / zoom;
  state.camera.updateProjectionMatrix();
  state.scene.updateMatrixWorld(true);
  state.renderer.render(state.scene, state.camera);
}

function pickSolarSystemPlanet(canvas, clientX, clientY) {
  const state = threeScenes.get(canvas);
  if (!state || state.id !== "solar-system" || state.selectedPlanet) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const pointer = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  state.scene.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, state.camera);
  const hits = raycaster.intersectObjects(state.group.children, true);
  return hits.map((hit) => hit.object.userData?.planetId).find(Boolean) || null;
}
function disposeThreeScene(canvas){const state=threeScenes.get(canvas);if(!state)return;state.scene.traverse(object=>{object.geometry?.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>{m.map?.dispose();m.dispose();});}});state.renderer.dispose();threeScenes.delete(canvas);}


const models = [
  { id: "solar-system", label: "Solar system", subject: "Astronomy · Space science", description: "Compare the arrangement of the Sun and eight planets along illustrative orbital paths. Distances and sizes are not to scale.", color: "#e7b76a" },
  { id: "planet", label: "Planet", subject: "Astronomy · Earth science", description: "Rotate a globe and inspect its curved surface, poles and equator.", color: "#4da9db" },
  { id: "molecule", label: "Molecule", subject: "Chemistry", description: "Explore a water molecule as connected atoms arranged in three-dimensional space.", color: "#9d83d8" },
  { id: "atom", label: "Atom", subject: "Physics · Chemistry", description: "Inspect a simplified atomic model with a nucleus and electron paths.", color: "#e5b75d" },
  { id: "dna", label: "DNA", subject: "Biology · Genetics", description: "Follow two twisting strands and the connecting base pairs of a DNA helix.", color: "#70c5a0" },
  { id: "cube", label: "3D geometry", subject: "Mathematics", description: "Rotate a cube to see its faces, edges and vertices from different angles.", color: "#c59be8" },
  { id: "terrain", label: "Mountain terrain", subject: "Geography · Geology", description: "Explore a raised terrain surface with peaks, valleys and contour-like depth.", color: "#d59b72" },
  { id: "cell", label: "Animal cell", subject: "Biology · Life science", description: "Explore a simplified animal cell, its membrane, nucleus and organelles in three dimensions.", color: "#79c8b2" },
  { id: "plant-cell", label: "Plant cell", subject: "Biology · Botany", description: "Explore a simplified plant cell with a cell wall, membrane, large vacuole, nucleus and chloroplasts.", color: "#8dc78a" },
  { id: "heart", label: "Heart model", subject: "Biology · Human body", description: "Inspect a simplified educational heart showing four chamber regions and major vessel pathways. It is not a medical or surgical model.", color: "#df8b9c" },
  { id: "pyramid", label: "Ancient pyramid", subject: "History · Geometry", description: "Rotate a simplified pyramid monument to inspect triangular faces, a square base and its three-dimensional form.", color: "#d7b17c" },
  { id: "ecosystem", label: "Forest ecosystem", subject: "Ecology · Environmental science", description: "Explore a simplified forest habitat with trees, plants, water and terrain. Organisms and relationships are illustrative, not a measured ecosystem.", color: "#77b982" },
  { id: "engine", label: "Mechanical engine", subject: "Engineering · Physics", description: "Inspect a simplified mechanical assembly with a crankshaft, connecting rods and piston-like cylinders. It is a conceptual model, not a working engine simulation.", color: "#91a8c7" },
  { id: "cart", label: "Force & motion cart", subject: "Physics · Mechanics", description: "Experiment with a small cart to explore how a push and friction affect motion. The movement is a qualitative learning illustration, not a measured physics simulation.", color: "#e2ae70" },
  { id: "bridge", label: "Truss bridge", subject: "Civil engineering · Physics", description: "Inspect a simplified steel truss bridge and trace how triangles, cross-bracing and the deck form a connected structure. This is a teaching model, not a load-rated design.", color: "#83b9d5" },
];

const modelExplorations = {
  planet: [
    { title: "Equator & poles", question: "How does the equator divide the globe?", explanation: "The equator is an imaginary circle halfway between the North and South Poles. It separates the Northern and Southern Hemispheres." },
    { title: "Rotation", question: "What causes day and night on Earth?", explanation: "Earth rotates around its axis. The side facing the Sun experiences day while the opposite side experiences night." },
    { title: "Latitude & longitude", question: "How can we describe a place on a globe?", explanation: "Latitude measures position north or south of the equator. Longitude measures position east or west of the Prime Meridian. Together they help locate places." },
  ],
  molecule: [
    { title: "Atoms", question: "What are the spheres representing?", explanation: "Atoms are the building blocks of molecules. In water, one oxygen atom is joined to two hydrogen atoms. Atom sizes in this teaching model are illustrative." },
    { title: "Bonds", question: "What holds the atoms together?", explanation: "Covalent bonds form when atoms share electron pairs. The bonds connect atoms into a molecule." },
    { title: "Molecular shape", question: "Why do molecules have different shapes?", explanation: "The arrangement of bonds and electron pairs influences molecular geometry. Water is bent, carbon dioxide is linear, and methane is tetrahedral." },
  ],
  atom: [
    { title: "Nucleus", question: "Where are protons and neutrons found?", explanation: "Protons and neutrons are concentrated in the tiny, dense nucleus at an atom's centre. Protons have positive charge; neutrons have no electric charge." },
    { title: "Electrons", question: "Where are electrons found?", explanation: "Electrons occupy quantum states around the nucleus. The paths shown here are a simplified teaching picture, not literal planetary orbits." },
    { title: "Atomic identity", question: "What makes one element different from another?", explanation: "The number of protons in the nucleus is the atomic number. Every atom of a given element has the same number of protons." },
  ],
  dna: [
    { title: "Double helix", question: "What shape do the two DNA strands form?", explanation: "DNA has two strands twisted into a double helix, often compared with a gently twisted ladder." },
    { title: "Base pairs", question: "Which bases pair across the two strands?", explanation: "Adenine pairs with thymine, and cytosine pairs with guanine. These complementary pairs help DNA store and copy genetic information." },
    { title: "Genes", question: "How do genes relate to DNA?", explanation: "A gene is a stretch of DNA whose sequence contributes to a functional product, often a protein or functional RNA. DNA contains many genes and other regions." },
  ],
  cube: [
    { title: "Faces", question: "How many flat faces does a cube have?", explanation: "A cube has six square faces. Opposite faces are parallel and all edges have equal length." },
    { title: "Edges", question: "Where do two faces meet?", explanation: "Two faces meet along an edge. A cube has twelve edges, and each edge has the same length." },
    { title: "Vertices", question: "What is a vertex?", explanation: "A vertex is a corner where edges meet. A cube has eight vertices, six faces and twelve edges." },
  ],
  terrain: [
    { title: "Peaks & valleys", question: "How can you tell a peak from a valley?", explanation: "A peak is a locally high area of land. A valley is lower ground between hills or mountains, often shaped by rivers or glaciers." },
    { title: "Erosion", question: "What can slowly reshape a mountain slope?", explanation: "Water, wind, ice and gravity wear away and move rock and soil. This process is called erosion and it can reshape landscapes over long periods." },
    { title: "Contour lines", question: "What does a contour line on a map connect?", explanation: "A contour line joins places with the same elevation. Close contour lines usually indicate a steeper slope than widely spaced lines." },
  ],
  cell: [
    { title: "Cell membrane", question: "What surrounds and protects the cell?", explanation: "The cell membrane forms a selectively permeable boundary. It helps regulate which substances enter and leave the cell." },
    { title: "Nucleus", question: "Where is most of a cell's DNA stored?", explanation: "In most animal cells, the nucleus contains most of the cell's genetic material and helps coordinate cell activities." },
    { title: "Mitochondria", question: "Which organelles help release usable energy?", explanation: "Mitochondria are sites of cellular respiration and help make ATP, a molecule cells use to transfer energy. This model simplifies their shape and number." },
  ],
  "solar-system": [
    { title: "The Sun", question: "Why do the planets orbit the Sun?", explanation: "The Sun's gravity keeps the planets in orbit. The planets also move sideways, so they continually fall around the Sun rather than straight into it." },
    { title: "Planet groups", question: "How do the inner planets differ from the outer giants?", explanation: "Mercury, Venus, Earth and Mars are rocky inner planets. Jupiter and Saturn are gas giants; Uranus and Neptune are ice giants." },
    { title: "Scale", question: "Are the planet sizes and distances shown accurately to scale?", explanation: "No. This arrangement is a learning illustration. Real planetary distances are enormous compared with the planet sizes, so a single view cannot show both clearly." },
  ],
  "plant-cell": [
    { title: "Cell wall", question: "What gives a plant cell extra support?", explanation: "A rigid cell wall made mainly of cellulose surrounds the cell membrane and helps a plant cell maintain its shape." },
    { title: "Chloroplasts", question: "Where does photosynthesis take place?", explanation: "Photosynthesis takes place in chloroplasts. Their chlorophyll absorbs light energy used to build sugars from carbon dioxide and water." },
    { title: "Vacuole", question: "Why is the large central vacuole useful?", explanation: "The central vacuole stores water and dissolved substances. Its pressure against the cell wall helps keep many plant tissues firm." },
  ],
  heart: [
    { title: "Four chambers", question: "How many chambers does a human heart have?", explanation: "The human heart has two atria and two ventricles. The atria receive blood; the ventricles pump blood out of the heart." },
    { title: "Lung circuit", question: "Where does blood go to collect oxygen?", explanation: "The right side pumps blood to the lungs. There, blood releases carbon dioxide and takes up oxygen before returning to the left side." },
    { title: "Body circuit", question: "Which side pumps oxygen-rich blood around the body?", explanation: "The left ventricle pumps oxygen-rich blood through the aorta to the body. This is a simplified educational overview, not a medical model." },
  ],
  pyramid: [
    { title: "Square base", question: "What shape is the base of this pyramid?", explanation: "This model has a square base. A square pyramid has one square base and four triangular side faces." },
    { title: "Triangular faces", question: "How many triangular sides meet at the top?", explanation: "Four triangular faces meet at the apex of a square pyramid. The apex is the highest point where the side faces meet." },
    { title: "History & engineering", question: "Why were large stone pyramids challenging to build?", explanation: "Builders had to plan foundations, move and position heavy stone blocks, organise skilled workers and manage materials. Specific construction methods varied by place and period." },
  ],
  ecosystem: [
    { title: "Producers", question: "Where does most energy in this habitat begin?", explanation: "Green plants are producers. They capture energy from sunlight and store some of it as chemical energy through photosynthesis." },
    { title: "Food web", question: "What connects plants, herbivores and predators?", explanation: "A food web links many food chains. Energy moves when organisms eat plants or other organisms; arrows point from the food to the eater." },
    { title: "Habitat balance", question: "What might happen if the water source disappears?", explanation: "Organisms that depend on that water may move, decline or compete more strongly. A habitat is a connected system, so one change can affect many populations." },
  ],
  bridge: [
    { title: "Triangular trusses", question: "Why are triangles used in a truss?", explanation: "A triangle keeps its shape when its side lengths stay fixed. Truss members use connected triangles to distribute forces through the structure." },
    { title: "Load path", question: "How does the bridge carry a load toward its supports?", explanation: "The deck transfers loads into the truss. The connected members carry tension or compression, and forces travel toward the supports and foundations." },
    { title: "Tension & compression", question: "What are two common forces in bridge members?", explanation: "Tension pulls a member apart; compression pushes it together. Which members experience each force depends on the bridge geometry and where the load acts." },
  ],
  engine: [
    { title: "Piston", question: "Which part moves back and forth inside a cylinder?", explanation: "The piston travels up and down inside the cylinder. In an engine, expanding hot gases push it and transfer force to the connecting rod." },
    { title: "Connecting rod", question: "How does the piston pass motion to the crankshaft?", explanation: "The connecting rod links the piston to the crankshaft. It transmits the piston's reciprocating motion to the rotating crank." },
    { title: "Crankshaft", question: "What does the crankshaft do with this motion?", explanation: "The crankshaft converts the piston's back-and-forth movement into rotation that can drive other parts. This model is conceptual, not a working simulation." },
  ],
  cart: [
    { title: "Applied force", question: "What can make the cart speed up?", explanation: "A push is an applied force. When the push is greater than opposing forces, the cart can accelerate in the direction of the net force." },
    { title: "Friction", question: "Why does the cart resist moving?", explanation: "Friction acts between surfaces in contact and opposes sliding or rolling motion. The amount depends on the surfaces and the physical situation." },
    { title: "Net force", question: "What happens when the push and friction balance?", explanation: "When forces balance, the net force is zero and acceleration is zero. An already-moving cart can keep moving at constant velocity in an idealised situation." },
  ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rotatePoint = ([x, y, z], yaw, pitch) => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
};

function project(point, width, height, zoom) {
  const perspective = 4.8 / (4.8 - point[2] * 0.55);
  return [width / 2 + point[0] * width * 0.32 * zoom * perspective, height / 2 + point[1] * height * 0.32 * zoom * perspective, point[2]];
}

function sphereMesh(radius = 1, latitudes = 18, longitudes = 28, color = "#4da9db") {
  const vertices = [];
  for (let lat = 0; lat <= latitudes; lat++) {
    const theta = (lat / latitudes) * Math.PI;
    for (let lon = 0; lon <= longitudes; lon++) {
      const phi = (lon / longitudes) * Math.PI * 2;
      vertices.push([radius * Math.sin(theta) * Math.cos(phi), radius * Math.cos(theta), radius * Math.sin(theta) * Math.sin(phi)]);
    }
  }
  const faces = [];
  for (let lat = 0; lat < latitudes; lat++) for (let lon = 0; lon < longitudes; lon++) {
    const a = lat * (longitudes + 1) + lon, b = a + longitudes + 1;
    faces.push({ points: [vertices[a], vertices[b], vertices[a + 1]], color }, { points: [vertices[a + 1], vertices[b], vertices[b + 1]], color });
  }
  return faces;
}

function makeModel(id, ecosystem = {}) {
  if (id === "planet") {
    return sphereMesh(1, 32, 48, "#328cc4").map((face) => {
      const center = face.points.reduce((acc, point) => [acc[0] + point[0] / 3, acc[1] + point[1] / 3, acc[2] + point[2] / 3], [0, 0, 0]);
      const [x, y, z] = center;
      const continentA = ((x + .28) ** 2 / .2 + (y - .24) ** 2 / .28 < 1) || ((x - .38) ** 2 / .12 + (y + .12) ** 2 / .3 < 1);
      const continentB = ((x + .42) ** 2 / .16 + (y + .38) ** 2 / .3 < 1) || ((x - .08) ** 2 / .11 + (y - .62) ** 2 / .09 < 1);
      const continentC = ((z > .48 && x > -.1 && y < .3) || (z < -.65 && x < .25 && y > -.1));
      return { ...face, color: continentA || continentB || continentC ? "#65ad78" : "#328cc4" };
    });
  }
  if (id === "molecule") {
    const kind = ecosystem.chemistryMolecule || "water";
    const focus = ecosystem.chemistryFocus || "all";
    const definitions = {
      water: {
        atoms: [
          { element: "O", p: [0, .08, 0], r: .36, c: "#e66b78", role: "oxygen" },
          { element: "H", p: [-.68, -.43, .12], r: .23, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [.68, -.43, .12], r: .23, c: "#e9edf7", role: "hydrogen" },
        ],
        bonds: [[0, 1], [0, 2]],
      },
      carbonDioxide: {
        atoms: [
          { element: "O", p: [-.9, 0, 0], r: .27, c: "#e66b78", role: "oxygen" },
          { element: "C", p: [0, 0, 0], r: .31, c: "#737b8d", role: "carbon" },
          { element: "O", p: [.9, 0, 0], r: .27, c: "#e66b78", role: "oxygen" },
        ],
        bonds: [[0, 1], [1, 2]],
      },
      methane: {
        atoms: [
          { element: "C", p: [0, 0, 0], r: .32, c: "#737b8d", role: "carbon" },
          { element: "H", p: [.72, .55, .55], r: .2, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [-.72, .55, -.55], r: .2, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [.55, -.65, -.55], r: .2, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [-.55, -.65, .55], r: .2, c: "#e9edf7", role: "hydrogen" },
        ],
        bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
      },
      ammonia: {
        atoms: [
          { element: "N", p: [0, .12, 0], r: .34, c: "#7298dc", role: "nitrogen" },
          { element: "H", p: [.72, -.38, .18], r: .2, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [-.66, -.42, .22], r: .2, c: "#e9edf7", role: "hydrogen" },
          { element: "H", p: [0, -.48, -.72], r: .2, c: "#e9edf7", role: "hydrogen" },
        ],
        bonds: [[0, 1], [0, 2], [0, 3]],
      },
    };
    const molecule = definitions[kind] || definitions.water;
    const atoms = molecule.atoms.map((atom) => ({
      ...atom,
      c: focus === "all" || focus === atom.role ? atom.c : "#55566a",
      r: focus === "all" || focus === atom.role ? atom.r : atom.r * .88,
    }));
    const rods = ecosystem.chemistryShowBonds === false ? [] : molecule.bonds.map(([a, b]) => [atoms[a].p, atoms[b].p]);
    return [...rods.map(([a, b]) => ({ points: [a, b], rod: true, color: "#b9c8e2" })), ...atoms.flatMap((atom) => sphereMesh(atom.r, 10, 16, atom.c).map((face) => ({ ...face, offset: atom.p })))];
  }
  if (id === "atom") {
    const nucleus = [[-.16, 0, 0], [.12, .12, .04], [.12, -.12, -.06], [0, .08, .15]];
    const faces = nucleus.flatMap((p, i) => sphereMesh(.19, 9, 14, i % 2 ? "#e58c79" : "#d8b0f2").map((face) => ({ ...face, offset: p })));
    const paths = [0, 1, 2].map((i) => ({ orbit: true, angle: i * Math.PI / 3, color: "#8fc9ef" }));
    const electrons = [0, 1, 2].map((i) => ({ electron: true, angle: i * Math.PI * 2 / 3 }));
    return [...faces, ...paths, ...electrons];
  }
  if (id === "cell") {
    const focus = ecosystem.cellFocus || "all";
    const outerColor = focus === "all" || focus === "membrane" ? "#4f9eaf" : "#3d4658";
    const outer = sphereMesh(.92, 20, 30, outerColor).map((face) => ({ ...face, color: outerColor }));
    const organelles = [
      { p: [0, .08, .08], r: .34, c: "#bd83d7", role: "nucleus" },
      { p: [-.48, -.2, .12], r: .15, c: "#e9b66c", role: "mitochondria" },
      { p: [.46, .28, -.18], r: .16, c: "#e9b66c", role: "mitochondria" },
      { p: [.22, -.42, .3], r: .11, c: "#77c69e", role: "endoplasmicReticulum" },
      { p: [-.2, .48, -.28], r: .1, c: "#77c69e", role: "endoplasmicReticulum" },
      { p: [.52, -.2, .18], r: .075, c: "#e6d28a", role: "ribosomes" },
      { p: [-.48, .28, -.2], r: .075, c: "#e6d28a", role: "ribosomes" },
    ];
    return [...outer, ...organelles.flatMap((item) => sphereMesh(item.r, 9, 14, focus === "all" || focus === item.role ? item.c : "#55566a").map((face) => ({ ...face, offset: item.p })))];
  }
  if (id === "plant-cell") {
    const focus = ecosystem.cellFocus || "all";
    const wallColor = focus === "all" || focus === "cellWall" ? "#a5d69a" : "#465b4c";
    const box = [[-1,-.72,-.72],[1,-.72,-.72],[1,.72,-.72],[-1,.72,-.72],[-1,-.72,.72],[1,-.72,.72],[1,.72,.72],[-1,.72,.72]];
    const shell = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]].map((face,i)=>({points:face.map(n=>box[n]),color:wallColor,solid:true}));
    const parts = [
      {p:[0,0,0],r:.48,c:"#76b9d9",role:"vacuole"},
      {p:[-.55,.28,.18],r:.16,c:"#9b75c8",role:"nucleus"},
      {p:[.48,.36,-.22],r:.13,c:"#77bd79",role:"chloroplasts"},
      {p:[-.48,-.35,-.18],r:.13,c:"#77bd79",role:"chloroplasts"},
      {p:[.5,-.3,.22],r:.13,c:"#77bd79",role:"chloroplasts"},
      {p:[-.05,.52,-.3],r:.1,c:"#e7c36e",role:"mitochondria"},
    ];
    return [...shell,...parts.flatMap((part)=>sphereMesh(part.r,8,12,focus === "all" || focus === part.role ? part.c : "#55566a").map((face)=>({...face,offset:part.p})))];
  }
  if (id === "heart") {
    const stage = ecosystem.heartFlow || "body";
    const chamberColors = {
      body: ["#397fb5", "#397fb5", "#397fb5", "#397fb5"],
      lungs: ["#397fb5", "#397fb5", "#c95e78", "#c95e78"],
      return: ["#c95e78", "#c95e78", "#c95e78", "#c95e78"],
    };
    const colors = chamberColors[stage] || chamberColors.body;
    const parts = [
      {p:[-.28,.18,0],r:.48,c:colors[0]},{p:[.28,.18,0],r:.48,c:colors[1]},
      {p:[-.22,-.34,.04],r:.38,c:colors[2]},{p:[.22,-.34,.04],r:.38,c:colors[3]},
      {p:[-.2,.78,-.08],r:.12,c:"#6b9dc7"},{p:[.22,.78,-.08],r:.12,c:"#c96a62"},
    ];
    const vessels=[{a:[-.2,.68,-.08],b:[-.34,1.18,-.08],c:stage==="lungs"?"#c95e78":"#397fb5"},{a:[.22,.68,-.08],b:[.42,1.12,-.08],c:stage==="return"?"#397fb5":"#c96a62"}];
    return [...vessels.map(v=>({points:[v.a,v.b],rod:true,color:v.c})),...parts.flatMap(part=>sphereMesh(part.r,10,14,part.c).map(face=>({...face,offset:part.p})))];
  }
  if (id === "pyramid") {
    const base=[[-1,-.7,-1],[1,-.7,-1],[1,-.7,1],[-1,-.7,1]], tip=[0,1,0];
    return [
      {points:[base[0],base[1],tip],color:"#d8b77f",solid:true},
      {points:[base[1],base[2],tip],color:"#c8a36d",solid:true},
      {points:[base[2],base[3],tip],color:"#e0c18e",solid:true},
      {points:[base[3],base[0],tip],color:"#b99060",solid:true},
      {points:base,color:"#9e815f",solid:true},
    ];
  }
  if (id === "ecosystem") {
    const ground = [], n = 10;
    const rainfall = clamp(Number(ecosystem.rainfall ?? 70), 0, 100);
    const pollution = clamp(Number(ecosystem.pollution ?? 15), 0, 100);
    const dry = rainfall < 35;
    const polluted = pollution >= 60;
    const waterPresent = ecosystem.waterSource !== false;
    for (let z=0;z<n;z++) for(let x=0;x<n;x++){const x0=(x/n-.5)*2.8,x1=((x+1)/n-.5)*2.8,z0=(z/n-.5)*2.2,z1=((z+1)/n-.5)*2.2,y=-.62+.06*Math.sin(x0*3)*Math.cos(z0*2);ground.push({points:[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],color:dry?((x+z)%2?"#9a8058":"#a88d61"):((x+z)%2?"#537e57":"#638d5d"),solid:true});}
    const trees=[[-.9,.1,-.45],[-.35,.12,-.65],[.48,.08,-.55],[.95,.08,.1],[-.7,.08,.55],[.25,.1,.58]];
    const forest=trees.flatMap(([x,y,z],i)=>[{points:[[x,y-.05,z],[x,y+.58,z]],rod:true,color:"#896448"},...sphereMesh(.34,9,13,dry?"#a18a59":polluted?"#718b61":i%2?"#4f9d68":"#68b879").map(face=>({...face,offset:[x,y+.82,z]})),...sphereMesh(.22,8,12,dry?"#b29a67":polluted?"#87946b":"#83c98a").map(face=>({...face,offset:[x+.16,y+1.03,z+.05]}))]);
    const stream = waterPresent ? [{points:[[-1.3,-.55,.2],[-.5,-.53,.1]],rod:true,color:"#62b8d5"},{points:[[-.5,-.53,.1],[.4,-.54,.2]],rod:true,color:"#62b8d5"}] : [];
    return [...ground,...stream,...forest];
  }
  if (id === "cart") {
    const force = clamp(Number(ecosystem.physicsForce ?? 6), 0, 10);
    const friction = clamp(Number(ecosystem.physicsFriction ?? 2), 0, 10);
    const mass = clamp(Number(ecosystem.physicsMass ?? 2), 1, 5);
    const netForce = force - friction;
    const acceleration = netForce / mass;
    // The cart's offset is an illustrative response to acceleration, not a
    // time-based motion prediction or a measured physical experiment.
    const displacement = clamp(acceleration * .12, -0.7, 0.7);
    const x = displacement;
    const body = [
      { points: [[x-.55,-.12,-.18],[x+.55,-.12,-.18],[x+.55,.25,-.18],[x-.55,.25,-.18]], color: "#d89a5b", solid: true },
      { points: [[x-.55,.25,-.18],[x+.55,.25,-.18],[x+.38,.48,-.18],[x-.38,.48,-.18]], color: "#efc48c", solid: true },
      { points: [[x-.55,-.12,-.18],[x-.55,.25,-.18],[x-.55,.25,.25],[x-.55,-.12,.25]], color: "#b97845", solid: true },
      { points: [[x+.55,-.12,-.18],[x+.55,.25,-.18],[x+.55,.25,.25],[x+.55,-.12,.25]], color: "#c98750", solid: true },
      { points: [[-1.35,-.56,0],[1.35,-.56,0]], rod: true, color: "#9ba6b8" },
      { points: [[x-.28,-.25,-.18],[x-.28,-.25,.25]], rod: true, color: "#64748b" },
      { points: [[x+.28,-.25,-.18],[x+.28,-.25,.25]], rod: true, color: "#64748b" },
    ];
    const wheels = [-.28,.28].flatMap(dx => [-.18,.25].flatMap(z => sphereMesh(.17,9,13,"#596579").map(face=>({...face,offset:[x+dx,-.35,z]}))));
    const forceArrow = force > 0 ? [{points:[[x+.58,.05,.18],[x+.58+force*.12,.05,.18]],rod:true,color:"#e7bd63"},{points:[[x+.58+force*.12,.05,.18],[x+.48+force*.12,.13,.18]],rod:true,color:"#e7bd63"},{points:[[x+.58+force*.12,.05,.18],[x+.48+force*.12,-.03,.18]],rod:true,color:"#e7bd63"}] : [];
    return [...body,...wheels,...forceArrow];
  }
  if (id === "engine") {
    const phase = ecosystem.engineCycle || "intake";
    const pistonY = phase === "intake" ? .34 : phase === "compression" ? .58 : phase === "power" ? -.08 : .58;
    const pistons=[-.62,0,.62].flatMap((x,i)=>[{points:[[x,-.4,-.18],[x,pistonY,-.18]],rod:true,color:i===1?"#d7b46e":"#8fa9c5"},...sphereMesh(.2,9,13,i===1?"#d7b46e":"#91a9c2").map(face=>({...face,offset:[x,pistonY,-.18]})),{points:[[x,-.4,-.18],[x,-.72,.2]],rod:true,color:"#c4cbd8"}]);
    const crank=[{points:[[-.85,-.72,.2],[.85,-.72,.2]],rod:true,color:"#d4a95f"},{points:[[-.85,-.72,.2],[-.85,-.45,.2]],rod:true,color:"#d4a95f"},{points:[[.85,-.72,.2],[.85,-.45,.2]],rod:true,color:"#d4a95f"}];
    return [...pistons,...crank,...[-.85,.85].flatMap(x=>sphereMesh(.27,10,16,"#718eae").map(face=>({...face,offset:[x,-.95,.2]})))];
  }
  if (id === "solar-system") {
    const planets = [
      { d: .48, r: .045, c: "#a9a6a0", a: .3 }, { d: .72, r: .07, c: "#d8b27a", a: 1.1 },
      { d: .98, r: .075, c: "#4d9bd0", a: 2.1 }, { d: 1.25, r: .058, c: "#c9785d", a: 2.8 },
      { d: 1.58, r: .15, c: "#d6b58a", a: 3.7 }, { d: 1.9, r: .13, c: "#d8c18d", a: 4.5 },
      { d: 2.2, r: .095, c: "#7fc7d2", a: 5.2 }, { d: 2.48, r: .09, c: "#527fc2", a: 5.8 },
    ];
    const sun = sphereMesh(.23, 14, 22, "#f4c65e");
    const paths = planets.map((p) => ({ orbit: true, rx: p.d, ry: p.d * .62, angle: 0, color: "rgba(210,198,230,.55)" }));
    const worlds = planets.flatMap((p) => {
      const pos = [Math.cos(p.a) * p.d, 0, Math.sin(p.a) * p.d];
      return sphereMesh(p.r, 8, 12, p.c).map((face) => ({ ...face, offset: pos }));
    });
    return [...paths, ...sun, ...worlds];
  }
  if (id === "dna") {
    const faces = [];
    for (let i = 0; i < 34; i++) {
      const t = i / 34 * Math.PI * 4;
      const y = (i / 33 - .5) * 2.25;
      const a = [.55 * Math.cos(t), y, .55 * Math.sin(t)];
      const b = [-.55 * Math.cos(t), y, -.55 * Math.sin(t)];
      faces.push({ points: [a, b], rod: true, color: "#d7b4ed", thin: true });
      faces.push(...sphereMesh(.055, 5, 8, "#64c7a1").map((face) => ({ ...face, offset: a })));
      faces.push(...sphereMesh(.055, 5, 8, "#6daee8").map((face) => ({ ...face, offset: b })));
    }
    return faces;
  }
  if (id === "cube") {
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    return [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]].map((face, i) => ({ points: face.map((index) => v[index]), color: ["#6c91c7","#8e79c7","#6aafbd","#a987c9","#547d9e","#8e9acb"][i], solid: true }));
  }
  const faces = [];
  const n = 18;
  const heightAt = (x, z) => .12 + .62 * Math.exp(-((x + .28) ** 2 + (z - .12) ** 2) * 5) + .38 * Math.exp(-((x - .48) ** 2 + (z + .35) ** 2) * 9) - .12 * Math.exp(-((x - .1) ** 2 + (z - .55) ** 2) * 18);
  const grid = [];
  for (let z = 0; z <= n; z++) {
    grid[z] = [];
    for (let x = 0; x <= n; x++) {
      const px = (x / n - .5) * 2.3, pz = (z / n - .5) * 2.3;
      grid[z][x] = [px, heightAt(px, pz) - .5, pz];
    }
  }
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const shade = Math.round(95 + heightAt((x / n - .5) * 2.3, (z / n - .5) * 2.3) * 90);
    const color = `rgb(${shade},${Math.round(shade * .78)},${Math.round(shade * .58)})`;
    faces.push({ points: [grid[z][x], grid[z][x + 1], grid[z + 1][x]], color, solid: true }, { points: [grid[z][x + 1], grid[z + 1][x + 1], grid[z + 1][x]], color, solid: true });
  }
  return faces;
}

function illuminateFace(color, brightness) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return `rgb(${channels.map((value) => Math.round(clamp(value * brightness, 0, 255))).join(",")})`;
}

function drawScene(canvas, modelId, yaw, pitch, zoom, ecosystem = {}, time = 0, selectedPlanet = null) {
  renderThreeScene(canvas, modelId, yaw, pitch, zoom, time, selectedPlanet, ecosystem.orbitSpeed ?? 1, ecosystem.heartFlow ?? "body", ecosystem);
}

function animateScene(canvas, render) {
  let frame = 0;
  let active = true;
  let pageVisible = document.visibilityState !== "hidden";
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotion = Boolean(motionQuery?.matches);

  const cancelFrame = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  };
  const drawOnce = () => {
    if (active && pageVisible) render(performance.now());
  };
  const tick = (time) => {
    frame = 0;
    if (!active || !pageVisible || reducedMotion) return;
    render(time);
    frame = window.requestAnimationFrame(tick);
  };
  const start = () => {
    if (!active || !pageVisible) return;
    cancelFrame();
    if (reducedMotion) drawOnce();
    else frame = window.requestAnimationFrame(tick);
  };
  const onVisibilityChange = () => {
    pageVisible = document.visibilityState !== "hidden";
    if (pageVisible) start();
    else cancelFrame();
  };
  const onMotionChange = (event) => {
    reducedMotion = event.matches;
    start();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  motionQuery?.addEventListener?.("change", onMotionChange);
  start();

  return () => {
    active = false;
    cancelFrame();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionQuery?.removeEventListener?.("change", onMotionChange);
  };
}

export function Mini3DModel({ modelId = "planet" }) {
  const [rotation, setRotation] = useState({ yaw: -.55, pitch: -.22 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = (time = 0) => drawScene(canvas, modelId, rotation.yaw, rotation.pitch, zoom, {}, time);
    const stopAnimation = animateScene(canvas, render);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => render()) : null;
    observer?.observe(canvas);
    return () => { stopAnimation(); observer?.disconnect(); disposeThreeScene(canvas); };
  }, [modelId, rotation, zoom]);
  function pointerDown(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: rotation.yaw, pitch: rotation.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!dragRef.current) return;
    setRotation({ yaw: dragRef.current.yaw + (event.clientX - dragRef.current.x) * .009, pitch: clamp(dragRef.current.pitch + (event.clientY - dragRef.current.y) * .009, -1.35, 1.35) });
  }
  return <div className="learning-3d-inline">
    <canvas ref={canvasRef} role="application" tabIndex={0} aria-label={`Interactive rotating 3D ${modelId} model. Drag to rotate, use arrow keys to rotate, and use plus or minus buttons to zoom.`} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); setRotation((value) => ({ yaw: value.yaw + (event.key === "ArrowLeft" ? -.12 : event.key === "ArrowRight" ? .12 : 0), pitch: clamp(value.pitch + (event.key === "ArrowUp" ? -.12 : event.key === "ArrowDown" ? .12 : 0), -1.35, 1.35) })); } }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onWheel={(event) => { event.preventDefault(); setZoom((value) => clamp(value - event.deltaY * .001, .65, 1.8)); }} />
    <div className="learning-3d-inline-controls">
      <button type="button" onClick={() => setZoom((value) => clamp(value + .12, .65, 1.8))} aria-label="Zoom in">＋</button>
      <button type="button" onClick={() => setZoom((value) => clamp(value - .12, .65, 1.8))} aria-label="Zoom out">−</button>
      <button type="button" onClick={() => { setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }}>Reset</button>
    </div>
  </div>;
}

export default function Interactive3DWorld({ selectedPlanet, onSelectedPlanetChange }) {
  const [modelId, setModelId] = useState("cell");
  const [rotation, setRotation] = useState({ yaw: -.55, pitch: -.22 });
  const [zoom, setZoom] = useState(1);
  const [conceptIndex, setConceptIndex] = useState(0);
  const [ecosystem, setEcosystem] = useState({ rainfall: 70, waterSource: true, pollution: 15, engineCycle: "intake", physicsForce: 6, physicsFriction: 2, physicsMass: 2, chemistryMolecule: "water", chemistryFocus: "all", chemistryShowBonds: true, orbitSpeed: 1, cellFocus: "all", bridgeLoad: "center" });
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const model = models.find((item) => item.id === modelId) || models[0];
  const selectedPlanetInfo = solarPlanets.find((item) => item.id === selectedPlanet) || null;
  const displayedTitle = selectedPlanetInfo ? selectedPlanetInfo.label : model.label;
  const displayedDescription = selectedPlanetInfo ? selectedPlanetInfo.description : model.description;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = (time = 0) => drawScene(canvas, modelId, rotation.yaw, rotation.pitch, zoom, ecosystem, time, selectedPlanet);
    const stopAnimation = animateScene(canvas, render);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => render()) : null;
    observer?.observe(canvas);
    return () => { stopAnimation(); observer?.disconnect(); };
  }, [modelId, selectedPlanet, rotation, zoom, ecosystem]);

  function onPointerDown(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: rotation.yaw, pitch: rotation.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x, dy = event.clientY - dragRef.current.y;
    setRotation({ yaw: dragRef.current.yaw + dx * .009, pitch: clamp(dragRef.current.pitch + dy * .009, -1.35, 1.35) });
  }
  function onPointerUp(event) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || modelId !== "solar-system" || selectedPlanet) return;
    const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    if (moved > 10) return;
    const planetId = pickSolarSystemPlanet(canvasRef.current, event.clientX, event.clientY);
    if (planetId) {
      onSelectedPlanetChange(planetId);
      setConceptIndex(0);
      setRotation({ yaw: -.28, pitch: -.12 });
      setZoom(1);
    }
  }
  function onWheel(event) { event.preventDefault(); setZoom((value) => clamp(value - event.deltaY * .001, .65, 1.8)); }

  return (
    <section className="learning-3d-lab" aria-label="Interactive three-dimensional learning lab">
      <div className="learning-section-heading"><div><span>INTERACTIVE 3D LEARNING</span><h2>Step inside the subject</h2></div><span className="space-explorer-tag">ROTATE · EXPLORE · DISCOVER</span></div>
      <p className="space-explorer-intro">These are interactive 3D educational models—not flat pictures. Choose a model, drag to rotate it, and zoom in to inspect its structure.</p>
      <div className="learning-3d-layout">
        <div className="learning-3d-viewer">
          <canvas ref={canvasRef} role="application" tabIndex={0} aria-label={modelId === "solar-system" && !selectedPlanet ? "Interactive solar system. Tap a planet to open a detailed 3D view, or drag to rotate the system." : `Interactive 3D model: ${displayedTitle}. Drag or use arrow keys to rotate the viewing angle.`} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); setRotation((value) => ({ yaw: value.yaw + (event.key === "ArrowLeft" ? -.12 : event.key === "ArrowRight" ? .12 : 0), pitch: clamp(value.pitch + (event.key === "ArrowUp" ? -.12 : event.key === "ArrowDown" ? .12 : 0), -1.35, 1.35) })); } }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} />
          <div className="learning-3d-controls">
            <button type="button" onClick={() => setZoom((value) => clamp(value + .12, .65, 1.8))} aria-label="Zoom in">＋</button>
            <button type="button" onClick={() => setZoom((value) => clamp(value - .12, .65, 1.8))} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => { setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }}>Reset view</button>
            <span>Zoom {Math.round(zoom * 100)}%</span>
          </div>
        </div>
        <aside className="learning-3d-details">
          <span>{selectedPlanetInfo ? "PLANET EXPLORER" : "NOW EXPLORING"}</span><h3>{displayedTitle}</h3><small>{selectedPlanetInfo ? selectedPlanetInfo.family : model.subject}</small><p>{displayedDescription}</p>
          {selectedPlanetInfo && <p className="learning-planet-stats">Diameter <strong>{selectedPlanetInfo.diameter}</strong><span>·</span> Average solar distance <strong>{selectedPlanetInfo.orbit}</strong></p>}
          {selectedPlanetInfo && <button type="button" className="learning-planet-back" onClick={() => { onSelectedPlanetChange(null); setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }}>← Back to all eight planets</button>}
          {modelId === "solar-system" && !selectedPlanetInfo && <p className="learning-planet-instruction">Tap any planet in the 3D scene or choose its name below to enter its world.</p>}
          {modelId === "solar-system" && !selectedPlanetInfo && <div className="learning-3d-experiment" aria-label="Planetary orbit experiment">
            <span>EXPERIMENT WITH ORBITAL MOTION</span>
            <p>Change the animation speed to compare how the planets move along their paths. This is an educational animation, not a real-time scale model of orbital periods.</p>
            <div className="learning-3d-experiment-control"><label htmlFor="orbit-speed">Orbit animation: {ecosystem.orbitSpeed === 0 ? "Paused" : ecosystem.orbitSpeed.toFixed(1) + "× speed"}</label>
              <input id="orbit-speed" type="range" min="0" max="3" step="0.5" value={ecosystem.orbitSpeed} onChange={(event) => setEcosystem((value) => ({ ...value, orbitSpeed: Number(event.target.value) }))} />
            </div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{ecosystem.orbitSpeed === 0 ? "The orbital animation is paused. Notice how each planet stays on its orbital path." : "The animation is running. Inner planets complete their illustrated paths more quickly than outer planets, showing the difference in orbital periods."}</p>
            <button type="button" onClick={() => setEcosystem((value) => ({ ...value, orbitSpeed: 1 }))}>Reset orbital speed</button>
          </div>}
          {modelId === "solar-system" && <div className="learning-planet-picker" role="group" aria-label="Choose a planet">{solarPlanets.map((planet) => <button type="button" key={planet.id} className={selectedPlanet === planet.id ? "active" : ""} aria-pressed={selectedPlanet === planet.id} onClick={() => { onSelectedPlanetChange(planet.id); setRotation({ yaw: -.28, pitch: -.12 }); setZoom(1); }}>{planet.label}</button>)}</div>}
          {modelId === "heart" && <div className="learning-3d-experiment" aria-label="Heart and circulation learning lab">
            <span>FOLLOW THE CIRCULATION JOURNEY</span>
            <p>Trace blood through the heart, lungs and body. Blue represents oxygen-poor blood and red represents oxygen-rich blood in this simplified teaching illustration.</p>
            <div className="learning-3d-experiment-control"><strong>Choose a journey stage</strong><div role="group" aria-label="Blood circulation stage">
              {[["body", "1 · From body"], ["lungs", "2 · To lungs"], ["return", "3 · From lungs"]].map(([value, label]) => <button type="button" key={value} className={(ecosystem.heartFlow || "body") === value ? "active" : ""} aria-pressed={(ecosystem.heartFlow || "body") === value} onClick={() => setEcosystem((current) => ({ ...current, heartFlow: value }))}>{label}</button>)}
            </div></div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{({
              body: "Oxygen-poor blood returns from the body to the right side of the heart. It is then pumped toward the lungs through the pulmonary arteries.",
              lungs: "In the lungs, blood releases carbon dioxide and takes up oxygen. The pulmonary veins carry oxygen-rich blood back to the left side of the heart.",
              return: "Oxygen-rich blood enters the left side of the heart and is pumped through the aorta to the body, where tissues use oxygen.",
            })[ecosystem.heartFlow || "body"]}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, heartFlow: "body" }))}>Restart circulation journey</button>
          </div>}
          {(modelId === "cell" || modelId === "plant-cell") && <div className="learning-3d-experiment" aria-label="Interactive cell biology lab">
            <span>EXPLORE CELL STRUCTURES</span>
            <p>Switch between an animal cell and a plant cell. Highlight an organelle to discover its role. The structures are simplified teaching illustrations, not to scale.</p>
            <div className="learning-3d-experiment-control"><strong>Cell type</strong><div role="group" aria-label="Choose cell type">
              <button type="button" className={modelId === "cell" ? "active" : ""} aria-pressed={modelId === "cell"} onClick={() => { setModelId("cell"); setConceptIndex(0); setEcosystem((current) => ({ ...current, cellFocus: "all" })); }}>Animal cell</button>
              <button type="button" className={modelId === "plant-cell" ? "active" : ""} aria-pressed={modelId === "plant-cell"} onClick={() => { setModelId("plant-cell"); setConceptIndex(0); setEcosystem((current) => ({ ...current, cellFocus: "all" })); }}>Plant cell</button>
            </div></div>
            <div className="learning-3d-experiment-control"><strong>Highlight structure</strong><div role="group" aria-label="Highlight cell structure">
              {[["all", "All"], ["nucleus", "Nucleus"], ["mitochondria", "Mitochondria"], ...(modelId === "plant-cell" ? [["chloroplasts", "Chloroplasts"], ["vacuole", "Vacuole"], ["cellWall", "Cell wall"]] : [["endoplasmicReticulum", "ER"], ["ribosomes", "Ribosomes"], ["membrane", "Membrane"]])].map(([value, label]) => <button type="button" key={value} className={ecosystem.cellFocus === value ? "active" : ""} aria-pressed={ecosystem.cellFocus === value} onClick={() => setEcosystem((current) => ({ ...current, cellFocus: value }))}>{label}</button>)}
            </div></div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{({
              all: modelId === "plant-cell" ? "Plant cells have a cell wall, chloroplasts and a large central vacuole. They also contain a nucleus, mitochondria and other shared cell structures." : "Animal cells have a cell membrane, nucleus, mitochondria and other organelles. They do not have a cell wall or chloroplasts.",
              nucleus: "The nucleus stores most of the cell's genetic material and helps coordinate cell activities.",
              mitochondria: "Mitochondria carry out much of the cell's aerobic respiration and help supply usable energy in the form of ATP.",
              chloroplasts: "Chloroplasts contain chlorophyll and capture light energy for photosynthesis. They are found in plants and many algae, not animal cells.",
              vacuole: "A plant cell's large central vacuole stores cell sap and helps maintain turgor pressure.",
              cellWall: "The plant cell wall is a supportive outer layer made mainly of cellulose. It helps the cell maintain shape and resist pressure.",
              endoplasmicReticulum: "The endoplasmic reticulum is a membrane network involved in protein and lipid production and transport.",
              ribosomes: "Ribosomes are the structures where cells assemble proteins.",
              membrane: "The cell membrane forms a selectively permeable boundary that helps regulate what enters and leaves the cell.",
            })[ecosystem.cellFocus || "all"]}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, cellFocus: "all" }))}>Reset cell explorer</button>
          </div>}
          {modelId === "molecule" && <div className="learning-3d-experiment" aria-label="Interactive chemistry molecule lab">
            <span>BUILD & EXPLORE MOLECULES</span>
            <p>Choose a molecule, focus on an element, and show or hide its bonds. Rotate the model to inspect its shape. These are simplified educational models, not electron-density or scale-accurate simulations.</p>
            <div className="learning-3d-experiment-control"><label htmlFor="chemistry-molecule">Molecule</label>
              <select id="chemistry-molecule" value={ecosystem.chemistryMolecule} onChange={(event) => setEcosystem((current) => ({ ...current, chemistryMolecule: event.target.value, chemistryFocus: "all" }))}>
                <option value="water">Water · H₂O</option>
                <option value="carbonDioxide">Carbon dioxide · CO₂</option>
                <option value="methane">Methane · CH₄</option>
                <option value="ammonia">Ammonia · NH₃</option>
              </select>
            </div>
            <div className="learning-3d-experiment-control"><strong>Highlight element</strong><div role="group" aria-label="Highlight element">
              {[["all", "All atoms"], ["oxygen", "Oxygen"], ["hydrogen", "Hydrogen"], ["carbon", "Carbon"], ["nitrogen", "Nitrogen"]].map(([value, label]) => <button type="button" key={value} className={ecosystem.chemistryFocus === value ? "active" : ""} aria-pressed={ecosystem.chemistryFocus === value} onClick={() => setEcosystem((current) => ({ ...current, chemistryFocus: value }))}>{label}</button>)}
            </div></div>
            <div className="learning-3d-experiment-control"><strong>Covalent bonds</strong>
              <button type="button" className={ecosystem.chemistryShowBonds ? "active" : ""} aria-pressed={ecosystem.chemistryShowBonds} onClick={() => setEcosystem((current) => ({ ...current, chemistryShowBonds: !current.chemistryShowBonds }))}>{ecosystem.chemistryShowBonds ? "Bonds visible" : "Bonds hidden"}</button>
            </div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{({
              water: "Water (H₂O): two hydrogen atoms are covalently bonded to one oxygen atom. Its molecular shape is bent, with an H–O–H angle of about 104.5°.",
              carbonDioxide: "Carbon dioxide (CO₂): one carbon atom is bonded to two oxygen atoms. The molecule is linear, with a bond angle of 180°.",
              methane: "Methane (CH₄): one carbon atom forms four single covalent bonds to hydrogen atoms. The molecule has a tetrahedral shape, with bond angles of about 109.5°.",
              ammonia: "Ammonia (NH₃): one nitrogen atom forms three single covalent bonds to hydrogen atoms. Its molecular shape is trigonal pyramidal; the lone electron pair on nitrogen influences the shape.",
            })[ecosystem.chemistryMolecule]}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, chemistryMolecule: "water", chemistryFocus: "all", chemistryShowBonds: true }))}>Reset molecule lab</button>
          </div>}
          {modelId === "cart" && <div className="learning-3d-experiment" aria-label="Force and acceleration experiment">
            <span>INVESTIGATE NEWTON'S SECOND LAW</span>
            <p>Change the applied force, opposing force and cart mass. Compare the net force and acceleration. The 3D cart position is an illustration of the calculated acceleration, not a time-based motion prediction.</p>
            <div className="learning-3d-experiment-control"><label htmlFor="physics-force">Applied force: {ecosystem.physicsForce} N</label>
              <input id="physics-force" type="range" min="0" max="10" step="1" value={ecosystem.physicsForce} onChange={(event) => setEcosystem((current) => ({ ...current, physicsForce: Number(event.target.value) }))} />
            </div>
            <div className="learning-3d-experiment-control"><label htmlFor="physics-friction">Opposing force: {ecosystem.physicsFriction} N</label>
              <input id="physics-friction" type="range" min="0" max="10" step="1" value={ecosystem.physicsFriction} onChange={(event) => setEcosystem((current) => ({ ...current, physicsFriction: Number(event.target.value) }))} />
            </div>
            <div className="learning-3d-experiment-control"><label htmlFor="physics-mass">Cart mass: {ecosystem.physicsMass} kg</label>
              <input id="physics-mass" type="range" min="1" max="5" step="1" value={ecosystem.physicsMass} onChange={(event) => setEcosystem((current) => ({ ...current, physicsMass: Number(event.target.value) }))} />
            </div>
            <p className="learning-3d-experiment-observation" aria-live="polite">
              Net force = {ecosystem.physicsForce - ecosystem.physicsFriction} N ·
              Acceleration = {(ecosystem.physicsForce - ecosystem.physicsFriction) / ecosystem.physicsMass} m/s²
              {" — "}
              {ecosystem.physicsForce === ecosystem.physicsFriction
                ? "Balanced forces: net force is zero, so acceleration is zero."
                : ecosystem.physicsForce > ecosystem.physicsFriction
                  ? "The net force points in the direction of the applied push."
                  : "The net force points opposite to the applied push."}
              {" "}Using Newton's second law: a = Fnet ÷ m.
            </p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, physicsForce: 6, physicsFriction: 2, physicsMass: 2 }))}>Reset experiment</button>
          </div>}
          {modelId === "bridge" && <div className="learning-3d-experiment" aria-label="Bridge load path exploration">
            <span>EXPLORE HOW A BRIDGE CARRIES LOADS</span>
            <p>Move an illustrative load along the deck and discuss how the truss transfers forces toward its supports. This is a qualitative learning activity, not a structural analysis or safety assessment.</p>
            <div className="learning-3d-experiment-control"><strong>Illustrative load position</strong><div role="group" aria-label="Choose illustrative load position">
              {[["left", "Near left support"], ["center", "At midspan"], ["right", "Near right support"]].map(([value, label]) => <button type="button" key={value} className={(ecosystem.bridgeLoad || "center") === value ? "active" : ""} aria-pressed={(ecosystem.bridgeLoad || "center") === value} onClick={() => setEcosystem((current) => ({ ...current, bridgeLoad: value }))}>{label}</button>)}
            </div></div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{({
              left: "With the load near the left support, the nearby deck and truss members transfer forces toward that support. The exact member forces depend on the real bridge design and loading.",
              center: "A load near midspan is farther from both supports. The deck transfers it into the truss, which carries forces through connected members toward both supports.",
              right: "With the load near the right support, the nearby deck and truss members transfer forces toward that support. The exact member forces depend on the real bridge design and loading.",
            })[ecosystem.bridgeLoad || "center"]}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, bridgeLoad: "center" }))}>Reset load position</button>
          </div>}
          {modelId === "engine" && <div className="learning-3d-experiment" aria-label="Four-stroke engine learning experiment">
            <span>EXPLORE THE FOUR-STROKE CYCLE</span>
            <p>Choose a stage to see a simplified piston position. This is a conceptual teaching model, not a timed or mechanically accurate engine simulation.</p>
            <div className="learning-3d-experiment-control"><strong>Engine stage</strong><div role="group" aria-label="Engine cycle stage">
              {[
                ["intake", "1 · Intake"],
                ["compression", "2 · Compression"],
                ["power", "3 · Power"],
                ["exhaust", "4 · Exhaust"],
              ].map(([value, label]) => <button type="button" key={value} className={(ecosystem.engineCycle || "intake") === value ? "active" : ""} aria-pressed={(ecosystem.engineCycle || "intake") === value} onClick={() => setEcosystem((current) => ({ ...current, engineCycle: value }))}>{label}</button>)}
            </div></div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{({
              intake: "Intake: the piston moves down as the intake valve opens and the cylinder draws in an air–fuel mixture in a spark-ignition example.",
              compression: "Compression: the piston moves up and compresses the charge while the valves are closed.",
              power: "Power: combustion raises pressure and pushes the piston down, producing useful work.",
              exhaust: "Exhaust: the piston moves up as the exhaust valve opens and pushes burnt gases out.",
            })[ecosystem.engineCycle || "intake"]}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, engineCycle: "intake" }))}>Restart cycle</button>
          </div>}
          {modelId === "ecosystem" && <div className="learning-3d-experiment" aria-label="Forest habitat experiment">
            <span>INVESTIGATE A CHANGING HABITAT</span>
            <p>Adjust rainfall and air pollution, then observe how the illustrated habitat responds. This is a qualitative learning model, not a measured ecological forecast.</p>
            <div className="learning-3d-experiment-control"><label htmlFor="habitat-rainfall">Rainfall level: {ecosystem.rainfall}%</label>
              <input id="habitat-rainfall" type="range" min="0" max="100" step="5" value={ecosystem.rainfall} onChange={(event) => setEcosystem((value) => ({ ...value, rainfall: Number(event.target.value) }))} />
            </div>
            <div className="learning-3d-experiment-control"><strong>Freshwater stream</strong>
              <button type="button" className={ecosystem.waterSource ? "active" : ""} aria-pressed={ecosystem.waterSource} onClick={() => setEcosystem((value) => ({ ...value, waterSource: !value.waterSource }))}>{ecosystem.waterSource ? "Present" : "Removed"}</button>
            </div>
            <div className="learning-3d-experiment-control"><label htmlFor="habitat-pollution">Air pollution level: {ecosystem.pollution}%</label>
              <input id="habitat-pollution" type="range" min="0" max="100" step="5" value={ecosystem.pollution} onChange={(event) => setEcosystem((value) => ({ ...value, pollution: Number(event.target.value) }))} />
            </div>
            <p className="learning-3d-experiment-observation" aria-live="polite">
              {ecosystem.rainfall < 35
                ? "Low rainfall: the scene shows drier ground and stressed-looking foliage. Water availability can limit plant growth and affect animals that depend on plants or freshwater."
                : "Rainfall is not in the low range of this illustration. Compare the habitat as you reduce water availability."}
              {" "}
              {!ecosystem.waterSource ? "The stream is absent, removing a visible freshwater source from this habitat. " : "The stream remains available in the scene. "}
              {ecosystem.pollution >= 60
                ? "Higher pollution pressure is represented by muted foliage. Air pollutants can harm plants, animals and people."
                : "Pollution is below the high-pressure visual threshold in this illustration."}
              {" "}Look for links between water, plants and animals in the habitat.
            </p>
            <button type="button" onClick={() => setEcosystem((value) => ({ ...value, rainfall: 70, waterSource: true, pollution: 15 }))}>Reset experiment</button>
          </div>}
          <div className="learning-3d-concept-panel" aria-live="polite">
            <span>DISCOVERY GUIDE</span>
            <div className="learning-3d-concept-tabs">
              {(modelExplorations[modelId] || [{ title: "Observe", question: "What details can you notice as you rotate this model?", explanation: model.description }]).map((concept, index) => <button type="button" key={concept.title} className={conceptIndex === index ? "active" : ""} onClick={() => setConceptIndex(index)} aria-pressed={conceptIndex === index}>{concept.title}</button>)}
            </div>
            <strong>{(modelExplorations[modelId] || [{ question: "What details can you notice as you rotate this model?", explanation: model.description }])[conceptIndex]?.question}</strong>
            <p>{(modelExplorations[modelId] || [{ question: "What details can you notice as you rotate this model?", explanation: model.description }])[conceptIndex]?.explanation}</p>
          </div>
          <div className="learning-3d-model-list" aria-label="Choose a 3D model">
            {models.map((item) => <button type="button" key={item.id} className={item.id === modelId ? "active" : ""} onClick={() => { setModelId(item.id); setSelectedPlanet(null); setConceptIndex(0); setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }} aria-pressed={item.id === modelId}>{item.label}</button>)}
          </div>
          <p className="learning-3d-hint">On a touch screen, drag with one finger to rotate. Use the zoom controls to look closer.</p>
        </aside>
      </div>
    </section>
  );
}
