"use client";

import { useEffect, useRef, useState } from "react";

const models = [
  { id: "planet", label: "Planet", subject: "Astronomy · Earth science", description: "Rotate a globe and inspect its curved surface, poles and equator.", color: "#4da9db" },
  { id: "molecule", label: "Molecule", subject: "Chemistry", description: "Explore a water molecule as connected atoms arranged in three-dimensional space.", color: "#9d83d8" },
  { id: "atom", label: "Atom", subject: "Physics · Chemistry", description: "Inspect a simplified atomic model with a nucleus and electron paths.", color: "#e5b75d" },
  { id: "dna", label: "DNA", subject: "Biology · Genetics", description: "Follow two twisting strands and the connecting base pairs of a DNA helix.", color: "#70c5a0" },
  { id: "cube", label: "3D geometry", subject: "Mathematics", description: "Rotate a cube to see its faces, edges and vertices from different angles.", color: "#c59be8" },
  { id: "terrain", label: "Mountain terrain", subject: "Geography · Geology", description: "Explore a raised terrain surface with peaks, valleys and contour-like depth.", color: "#d59b72" },
  { id: "cell", label: "Animal cell", subject: "Biology · Life science", description: "Explore a simplified animal cell, its membrane, nucleus and organelles in three dimensions.", color: "#79c8b2" },
  { id: "solar-system", label: "Solar system", subject: "Astronomy · Space science", description: "Compare the arrangement of the Sun and eight planets along illustrative orbital paths. Distances and sizes are not to scale.", color: "#e7b76a" },
  { id: "plant-cell", label: "Plant cell", subject: "Biology · Botany", description: "Explore a simplified plant cell with a cell wall, membrane, large vacuole, nucleus and chloroplasts.", color: "#8dc78a" },
  { id: "heart", label: "Heart model", subject: "Biology · Human body", description: "Inspect a simplified educational heart showing four chamber regions and major vessel pathways. It is not a medical or surgical model.", color: "#df8b9c" },
  { id: "pyramid", label: "Ancient pyramid", subject: "History · Geometry", description: "Rotate a simplified pyramid monument to inspect triangular faces, a square base and its three-dimensional form.", color: "#d7b17c" },
  { id: "ecosystem", label: "Forest ecosystem", subject: "Ecology · Environmental science", description: "Explore a simplified forest habitat with trees, plants, water and terrain. Organisms and relationships are illustrative, not a measured ecosystem.", color: "#77b982" },
  { id: "engine", label: "Mechanical engine", subject: "Engineering · Physics", description: "Inspect a simplified mechanical assembly with a crankshaft, connecting rods and piston-like cylinders. It is a conceptual model, not a working engine simulation.", color: "#91a8c7" },
  { id: "cart", label: "Force & motion cart", subject: "Physics · Mechanics", description: "Experiment with a small cart to explore how a push and friction affect motion. The movement is a qualitative learning illustration, not a measured physics simulation.", color: "#e2ae70" },
];

const modelExplorations = {
  planet: [
    { title: "Equator & poles", question: "How does the equator divide the globe?", explanation: "The equator is an imaginary circle halfway between the North and South Poles. It separates the Northern and Southern Hemispheres." },
    { title: "Rotation", question: "What causes day and night on Earth?", explanation: "Earth rotates around its axis. The side facing the Sun experiences day while the opposite side experiences night." },
    { title: "Latitude & longitude", question: "How can we describe a place on a globe?", explanation: "Latitude measures position north or south of the equator. Longitude measures position east or west of the Prime Meridian. Together they help locate places." },
  ],
  molecule: [
    { title: "Atoms", question: "What are the three spheres representing?", explanation: "This simplified water molecule has one oxygen atom joined to two hydrogen atoms. The spheres represent atoms, not their exact relative sizes." },
    { title: "Bonds", question: "What holds the atoms together?", explanation: "Covalent bonds form when atoms share pairs of electrons. The O–H bonds hold the water molecule together." },
    { title: "Molecular shape", question: "Why is water not a straight-line molecule?", explanation: "The two O–H bonds form a bent shape because electron pairs around oxygen repel one another. The H–O–H angle is about 104.5 degrees." },
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
  return [width / 2 + point[0] * width * 0.28 * zoom * perspective, height / 2 + point[1] * height * 0.28 * zoom * perspective, point[2]];
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
    return sphereMesh(1, 22, 34, "#328cc4").map((face) => {
      const center = face.points.reduce((acc, point) => [acc[0] + point[0] / 3, acc[1] + point[1] / 3, acc[2] + point[2] / 3], [0, 0, 0]);
      const [x, y, z] = center;
      const continentA = ((x + .28) ** 2 / .2 + (y - .24) ** 2 / .28 < 1) || ((x - .38) ** 2 / .12 + (y + .12) ** 2 / .3 < 1);
      const continentB = ((x + .42) ** 2 / .16 + (y + .38) ** 2 / .3 < 1) || ((x - .08) ** 2 / .11 + (y - .62) ** 2 / .09 < 1);
      const continentC = ((z > .48 && x > -.1 && y < .3) || (z < -.65 && x < .25 && y > -.1));
      return { ...face, color: continentA || continentB || continentC ? "#65ad78" : "#328cc4" };
    });
  }
  if (id === "molecule") {
    const atoms = [{ p: [0, 0, 0], r: .34, c: "#e9edf7" }, { p: [-.72, -.48, .12], r: .22, c: "#e66b78" }, { p: [.72, -.48, .12], r: .22, c: "#e66b78" }];
    const rods = [[atoms[0].p, atoms[1].p], [atoms[0].p, atoms[2].p]];
    return [...rods.map(([a, b]) => ({ points: [a, b], rod: true, color: "#a8b6d0" })), ...atoms.flatMap((atom) => sphereMesh(atom.r, 10, 16, atom.c).map((face) => ({ ...face, offset: atom.p })))];
  }
  if (id === "atom") {
    const nucleus = [[-.16, 0, 0], [.12, .12, .04], [.12, -.12, -.06], [0, .08, .15]];
    const faces = nucleus.flatMap((p, i) => sphereMesh(.19, 9, 14, i % 2 ? "#e58c79" : "#d8b0f2").map((face) => ({ ...face, offset: p })));
    const paths = [0, 1, 2].map((i) => ({ orbit: true, angle: i * Math.PI / 3, color: "#8fc9ef" }));
    const electrons = [0, 1, 2].map((i) => ({ electron: true, angle: i * Math.PI * 2 / 3 }));
    return [...faces, ...paths, ...electrons];
  }
  if (id === "cell") {
    const outer = sphereMesh(.92, 20, 30, "#4f9eaf").map((face) => ({ ...face, color: "#4f9eaf" }));
    const organelles = [
      { p: [0, .08, .08], r: .34, c: "#bd83d7" },
      { p: [-.48, -.2, .12], r: .13, c: "#e9b66c" },
      { p: [.46, .28, -.18], r: .16, c: "#e9b66c" },
      { p: [.22, -.42, .3], r: .11, c: "#77c69e" },
      { p: [-.2, .48, -.28], r: .1, c: "#77c69e" },
      { p: [.52, -.2, .18], r: .075, c: "#e6d28a" },
      { p: [-.48, .28, -.2], r: .075, c: "#e6d28a" },
    ];
    return [...outer, ...organelles.flatMap((item) => sphereMesh(item.r, 9, 14, item.c).map((face) => ({ ...face, offset: item.p })))];
  }
  if (id === "plant-cell") {
    const box = [[-1,-.72,-.72],[1,-.72,-.72],[1,.72,-.72],[-1,.72,-.72],[-1,-.72,.72],[1,-.72,.72],[1,.72,.72],[-1,.72,.72]];
    const shell = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]].map((face,i)=>({points:face.map(n=>box[n]),color:i%2?"#7ebd83":"#a5d69a",solid:true}));
    const parts = [
      {p:[0,0,0],r:.42,c:"#76b9d9"}, {p:[-.55,.28,.18],r:.16,c:"#9b75c8"},
      {p:[.48,.36,-.22],r:.13,c:"#e7c36e"}, {p:[-.48,-.35,-.18],r:.13,c:"#e7c36e"},
      {p:[.5,-.3,.22],r:.13,c:"#e7c36e"}, {p:[-.05,.52,-.3],r:.1,c:"#9b75c8"},
    ];
    return [...shell,...parts.flatMap((part)=>sphereMesh(part.r,8,12,part.c).map((face)=>({...face,offset:part.p})))];
  }
  if (id === "heart") {
    const parts = [
      {p:[-.28,.18,0],r:.48,c:"#c95e78"},{p:[.28,.18,0],r:.48,c:"#d97786"},
      {p:[-.22,-.34,.04],r:.38,c:"#b84d69"},{p:[.22,-.34,.04],r:.38,c:"#d05d70"},
      {p:[-.2,.78,-.08],r:.12,c:"#6b9dc7"},{p:[.22,.78,-.08],r:.12,c:"#c96a62"},
    ];
    const vessels=[{a:[-.2,.68,-.08],b:[-.34,1.18,-.08],c:"#6b9dc7"},{a:[.22,.68,-.08],b:[.42,1.12,-.08],c:"#c96a62"}];
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
    const dry = ecosystem.rainfall === "low";
    const polluted = Boolean(ecosystem.pollution);
    const waterPresent = ecosystem.waterSource !== false;
    for (let z=0;z<n;z++) for(let x=0;x<n;x++){const x0=(x/n-.5)*2.8,x1=((x+1)/n-.5)*2.8,z0=(z/n-.5)*2.2,z1=((z+1)/n-.5)*2.2,y=-.62+.06*Math.sin(x0*3)*Math.cos(z0*2);ground.push({points:[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],color:dry?((x+z)%2?"#9a8058":"#a88d61"):((x+z)%2?"#537e57":"#638d5d"),solid:true});}
    const trees=[[-.9,.1,-.45],[-.35,.12,-.65],[.48,.08,-.55],[.95,.08,.1],[-.7,.08,.55],[.25,.1,.58]];
    const forest=trees.flatMap(([x,y,z],i)=>[{points:[[x,y-.05,z],[x,y+.58,z]],rod:true,color:"#896448"},...sphereMesh(.34,9,13,dry?"#a18a59":polluted?"#718b61":i%2?"#4f9d68":"#68b879").map(face=>({...face,offset:[x,y+.82,z]})),...sphereMesh(.22,8,12,dry?"#b29a67":polluted?"#87946b":"#83c98a").map(face=>({...face,offset:[x+.16,y+1.03,z+.05]}))]);
    const stream = waterPresent ? [{points:[[-1.3,-.55,.2],[-.5,-.53,.1]],rod:true,color:"#62b8d5"},{points:[[-.5,-.53,.1],[.4,-.54,.2]],rod:true,color:"#62b8d5"}] : [];
    return [...ground,...stream,...forest];
  }
  if (id === "cart") {
    const force = clamp(Number(ecosystem.physicsForce ?? 3), 0, 5);
    const friction = clamp(Number(ecosystem.physicsFriction ?? 1), 0, 5);
    const displacement = clamp((force - friction) * .16, -0.7, 0.7);
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

function drawScene(canvas, modelId, yaw, pitch, zoom, ecosystem = {}) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * .5, h * .48, 4, w * .5, h * .48, h * .55);
  glow.addColorStop(0, "#30294a"); glow.addColorStop(1, "#100f1b");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 42; i++) {
    const x = (i * 97 % 997) / 997 * w, y = (i * 53 % 991) / 991 * h;
    ctx.fillStyle = "rgba(226,215,255,.35)"; ctx.fillRect(x, y, 1.2, 1.2);
  }
  const model = makeModel(modelId, ecosystem);
  const drawables = model.map((face) => {
    const offset = face.offset || [0, 0, 0];
    const pts = face.points ? face.points.map((p) => project(rotatePoint([p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]], yaw, pitch), w, h, zoom)) : [];
    const centerZ = pts.length ? pts.reduce((sum, p) => sum + p[2], 0) / pts.length : 0;
    return { ...face, pts, centerZ };
  }).sort((a, b) => a.centerZ - b.centerZ);
  drawables.forEach((face) => {
    if (face.orbit) {
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(face.angle + yaw * .18);
      ctx.beginPath(); ctx.ellipse(0, 0, w * .11 * (face.rx || 2) * zoom, h * .055 * (face.ry || 1) * zoom, pitch * .22, 0, Math.PI * 2);
      ctx.strokeStyle = face.color; ctx.lineWidth = 1.4; ctx.globalAlpha = .75; ctx.stroke(); ctx.restore(); return;
    }
    if (face.electron) {
      const a = face.angle + yaw * .8, p = rotatePoint([Math.cos(a) * 1.12, Math.sin(a) * .82, Math.sin(a * 2) * .18], yaw, pitch);
      const q = project(p, w, h, zoom); ctx.beginPath(); ctx.arc(q[0], q[1], 4.5, 0, Math.PI * 2); ctx.fillStyle = "#9fe0ff"; ctx.shadowBlur = 13; ctx.shadowColor = "#9fe0ff"; ctx.fill(); ctx.shadowBlur = 0; return;
    }
    if (face.rod) {
      if (face.pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(face.pts[0][0], face.pts[0][1]); ctx.lineTo(face.pts[1][0], face.pts[1][1]);
      ctx.strokeStyle = face.color; ctx.lineWidth = face.thin ? 2 : 8; ctx.lineCap = "round"; ctx.globalAlpha = .9; ctx.stroke(); ctx.globalAlpha = 1; return;
    }
    if (face.pts.length < 3) return;
    ctx.beginPath(); ctx.moveTo(face.pts[0][0], face.pts[0][1]); face.pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = face.color; ctx.globalAlpha = face.solid ? .78 : .88; ctx.fill(); ctx.globalAlpha = 1;
    if (face.solid) { ctx.strokeStyle = "rgba(237,225,255,.17)"; ctx.lineWidth = .65; ctx.stroke(); }
  });
  if (modelId === "ecosystem" && ecosystem.pollution) {
    const haze = ctx.createLinearGradient(0, 0, 0, h);
    haze.addColorStop(0, "rgba(155,160,166,.18)"); haze.addColorStop(1, "rgba(155,160,166,.04)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = "rgba(235,226,255,.72)"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("DRAG TO ROTATE · SCROLL TO ZOOM", w / 2, h - 17);
}


export function Mini3DModel({ modelId = "planet" }) {
  const [rotation, setRotation] = useState({ yaw: -.55, pitch: -.22 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => drawScene(canvas, modelId, rotation.yaw, rotation.pitch, zoom);
    render();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(render) : null;
    observer?.observe(canvas);
    return () => observer?.disconnect();
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

export default function Interactive3DWorld() {
  const [modelId, setModelId] = useState("planet");
  const [rotation, setRotation] = useState({ yaw: -.55, pitch: -.22 });
  const [zoom, setZoom] = useState(1);
  const [conceptIndex, setConceptIndex] = useState(0);
  const [ecosystem, setEcosystem] = useState({ rainfall: "regular", waterSource: true, pollution: false, engineCycle: "intake", physicsForce: 3, physicsFriction: 1 });
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const model = models.find((item) => item.id === modelId) || models[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => drawScene(canvas, modelId, rotation.yaw, rotation.pitch, zoom, ecosystem);
    render();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(render) : null;
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [modelId, rotation, zoom, ecosystem]);

  function onPointerDown(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: rotation.yaw, pitch: rotation.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x, dy = event.clientY - dragRef.current.y;
    setRotation({ yaw: dragRef.current.yaw + dx * .009, pitch: clamp(dragRef.current.pitch + dy * .009, -1.35, 1.35) });
  }
  function onPointerUp() { dragRef.current = null; }
  function onWheel(event) { event.preventDefault(); setZoom((value) => clamp(value - event.deltaY * .001, .65, 1.8)); }

  return (
    <section className="learning-3d-lab" aria-label="Interactive three-dimensional learning lab">
      <div className="learning-section-heading"><div><span>INTERACTIVE 3D LEARNING</span><h2>Step inside the subject</h2></div><span className="space-explorer-tag">ROTATE · EXPLORE · DISCOVER</span></div>
      <p className="space-explorer-intro">These are interactive 3D educational models—not flat pictures. Choose a model, drag to rotate it, and zoom in to inspect its structure.</p>
      <div className="learning-3d-layout">
        <div className="learning-3d-viewer">
          <canvas ref={canvasRef} role="application" tabIndex={0} aria-label={`Interactive 3D model: ${model.label}. Drag or use arrow keys to rotate the viewing angle.`} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); setRotation((value) => ({ yaw: value.yaw + (event.key === "ArrowLeft" ? -.12 : event.key === "ArrowRight" ? .12 : 0), pitch: clamp(value.pitch + (event.key === "ArrowUp" ? -.12 : event.key === "ArrowDown" ? .12 : 0), -1.35, 1.35) })); } }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} />
          <div className="learning-3d-controls">
            <button type="button" onClick={() => setZoom((value) => clamp(value + .12, .65, 1.8))} aria-label="Zoom in">＋</button>
            <button type="button" onClick={() => setZoom((value) => clamp(value - .12, .65, 1.8))} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => { setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }}>Reset view</button>
            <span>Zoom {Math.round(zoom * 100)}%</span>
          </div>
        </div>
        <aside className="learning-3d-details">
          <span>NOW EXPLORING</span><h3>{model.label}</h3><small>{model.subject}</small><p>{model.description}</p>
          {modelId === "cart" && <div className="learning-3d-experiment" aria-label="Force and friction experiment">
            <span>TRY A FORCE & FRICTION EXPERIMENT</span>
            <p>Change the push and surface friction. Watch the cart shift to explore the idea of net force. This is a qualitative illustration, not a measured prediction.</p>
            <div className="learning-3d-experiment-control"><label htmlFor="physics-force">Applied push: {ecosystem.physicsForce}/5</label>
              <input id="physics-force" type="range" min="0" max="5" step="1" value={ecosystem.physicsForce} onChange={(event) => setEcosystem((current) => ({ ...current, physicsForce: Number(event.target.value) }))} />
            </div>
            <div className="learning-3d-experiment-control"><label htmlFor="physics-friction">Surface friction: {ecosystem.physicsFriction}/5</label>
              <input id="physics-friction" type="range" min="0" max="5" step="1" value={ecosystem.physicsFriction} onChange={(event) => setEcosystem((current) => ({ ...current, physicsFriction: Number(event.target.value) }))} />
            </div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{ecosystem.physicsForce === ecosystem.physicsFriction ? "Balanced forces: the net force is zero in this simplified comparison. Acceleration is zero." : ecosystem.physicsForce > ecosystem.physicsFriction ? "The push is greater than the opposing friction in this illustration, so the cart shifts in the push direction." : "Friction is greater than the push in this illustration, so the net force points opposite the push."}</p>
            <button type="button" onClick={() => setEcosystem((current) => ({ ...current, physicsForce: 3, physicsFriction: 1 }))}>Reset experiment</button>
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
            <span>TRY A HABITAT EXPERIMENT</span>
            <p>Change one condition and observe the illustrative habitat. These are qualitative teaching outcomes, not measured ecological predictions.</p>
            <div className="learning-3d-experiment-control"><strong>Rainfall</strong><div role="group" aria-label="Rainfall level"><button type="button" className={ecosystem.rainfall === "regular" ? "active" : ""} aria-pressed={ecosystem.rainfall === "regular"} onClick={() => setEcosystem((value) => ({ ...value, rainfall: "regular" }))}>Regular</button><button type="button" className={ecosystem.rainfall === "low" ? "active" : ""} aria-pressed={ecosystem.rainfall === "low"} onClick={() => setEcosystem((value) => ({ ...value, rainfall: "low" }))}>Low</button></div></div>
            <div className="learning-3d-experiment-control"><strong>Water source</strong><button type="button" className={ecosystem.waterSource ? "active" : ""} aria-pressed={ecosystem.waterSource} onClick={() => setEcosystem((value) => ({ ...value, waterSource: !value.waterSource }))}>{ecosystem.waterSource ? "Present" : "Removed"}</button></div>
            <div className="learning-3d-experiment-control"><strong>Air pollution</strong><button type="button" className={ecosystem.pollution ? "active" : ""} aria-pressed={ecosystem.pollution} onClick={() => setEcosystem((value) => ({ ...value, pollution: !value.pollution }))}>{ecosystem.pollution ? "Higher" : "Lower"}</button></div>
            <p className="learning-3d-experiment-observation" aria-live="polite">{ecosystem.waterSource && ecosystem.rainfall === "regular" && !ecosystem.pollution ? "Balanced starting scene: the stream is present and foliage is shown as healthy." : `${!ecosystem.waterSource ? "The stream is removed. " : ""}${ecosystem.rainfall === "low" ? "Lower rainfall changes the ground and foliage colours. " : ""}${ecosystem.pollution ? "A visible haze represents an added pollution pressure. " : ""}Discuss which organisms may be affected and why.`}</p>
            <button type="button" onClick={() => setEcosystem({ rainfall: "regular", waterSource: true, pollution: false })}>Reset experiment</button>
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
            {models.map((item) => <button type="button" key={item.id} className={item.id === modelId ? "active" : ""} onClick={() => { setModelId(item.id); setConceptIndex(0); setRotation({ yaw: -.55, pitch: -.22 }); setZoom(1); }} aria-pressed={item.id === modelId}>{item.label}</button>)}
          </div>
          <p className="learning-3d-hint">On a touch screen, drag with one finger to rotate. Use the zoom controls to look closer.</p>
        </aside>
      </div>
    </section>
  );
}
