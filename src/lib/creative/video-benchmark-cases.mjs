/**
 * Synthetic multi-shot video planning cases for offline continuity preflight.
 * These describe expected structure only; they do not evaluate rendered pixels or motion.
 */
const CASES = [
  { id:"VID-001", category:"character-continuity", title:"Runner crosses a street", shotCount:3, required:["subjectId","wardrobeId","cameraSide","screenDirection","actionProgress"], expected:{subjectId:"runner-01",wardrobeId:"track-kit-01",cameraSide:"left",screenDirection:"left-to-right",actionProgress:[0,1,2]} },
  { id:"VID-002", category:"product-continuity", title:"Bottle reveal and hero close-up", shotCount:3, required:["subjectId","propIds","cameraSide","actionProgress"], expected:{subjectId:"bottle-01",propIds:["cap-01","label-01"],cameraSide:"right",actionProgress:[0,1,2]} },
  { id:"VID-003", category:"dialogue-continuity", title:"Two-person conversation", shotCount:4, required:["subjectId","wardrobeId","cameraSide","screenDirection","actionProgress"], expected:{subjectId:"speaker-a",wardrobeId:"jacket-01",cameraSide:"left",screenDirection:"left-to-right",actionProgress:[0,1,2,3]} },
  { id:"VID-004", category:"environment-continuity", title:"Cyclist enters a forest path", shotCount:3, required:["subjectId","wardrobeId","propIds","cameraSide","actionProgress"], expected:{subjectId:"cyclist-01",wardrobeId:"cycling-kit-01",propIds:["bicycle-01","helmet-01"],cameraSide:"right",actionProgress:[0,1,2]} },
  { id:"VID-005", category:"camera-continuity", title:"Orbit around a sculpture", shotCount:3, required:["subjectId","cameraSide","screenDirection","actionProgress"], expected:{subjectId:"sculpture-01",cameraSide:"left",screenDirection:"clockwise",actionProgress:[0,1,2]} },
  { id:"VID-006", category:"transition-coherence", title:"Day-to-night doorway transition", shotCount:3, required:["subjectId","wardrobeId","transition","actionProgress"], expected:{subjectId:"traveler-01",wardrobeId:"coat-01",actionProgress:[0,1,2]} },
  { id:"VID-007", category:"temporal-progression", title:"Pouring water into a glass", shotCount:3, required:["subjectId","propIds","actionProgress"], expected:{subjectId:"glass-01",propIds:["pitcher-01"],actionProgress:[0,1,2]} },
  { id:"VID-008", category:"motion-continuity", title:"Dog catches a flying disc", shotCount:3, required:["subjectId","propIds","screenDirection","actionProgress"], expected:{subjectId:"dog-01",propIds:["disc-01"],screenDirection:"left-to-right",actionProgress:[0,1,2]} },
  { id:"VID-009", category:"wardrobe-continuity", title:"Chef plates a dish", shotCount:3, required:["subjectId","wardrobeId","actionProgress"], expected:{subjectId:"chef-01",wardrobeId:"chef-coat-01",actionProgress:[0,1,2]} },
  { id:"VID-010", category:"multi-subject-continuity", title:"Friends pass a ball", shotCount:4, required:["subjectId","wardrobeId","propIds","screenDirection","actionProgress"], expected:{subjectId:"player-a",wardrobeId:"blue-shirt-01",propIds:["ball-01"],screenDirection:"left-to-right",actionProgress:[0,1,2,3]} },
  { id:"VID-011", category:"scale-continuity", title:"Macro-to-wide product reveal", shotCount:3, required:["subjectId","propIds","actionProgress"], expected:{subjectId:"watch-01",propIds:["watch-strap-01"],actionProgress:[0,1,2]} },
  { id:"VID-012", category:"transition-coherence", title:"Match-cut from hand to object", shotCount:2, required:["subjectId","propIds","transition","actionProgress"], expected:{subjectId:"hand-01",propIds:["key-01"],actionProgress:[0,1]} },
];
export const VIDEO_BENCHMARK_CASES = Object.freeze(CASES.map((item) => Object.freeze({
  ...item,
  required:Object.freeze([...item.required]),
  expected:Object.freeze({...item.expected, ...(item.expected.propIds ? {propIds:Object.freeze([...item.expected.propIds])} : {}), actionProgress:Object.freeze([...item.expected.actionProgress])}),
})));
const BY_ID = new Map(VIDEO_BENCHMARK_CASES.map((item)=>[item.id,item]));
export function getVideoBenchmarkCase(caseId) { return BY_ID.get(caseId) ?? null; }
export const VIDEO_BENCHMARK_CATEGORIES = Object.freeze([...new Set(VIDEO_BENCHMARK_CASES.map((item)=>item.category))].sort());
