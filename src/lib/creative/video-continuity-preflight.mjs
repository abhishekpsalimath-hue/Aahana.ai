import { getVideoBenchmarkCase } from "./video-benchmark-cases.mjs";

const DIRECTIONS = new Set(["left-to-right","right-to-left","toward-camera","away-from-camera","clockwise","counter-clockwise","static"]);
const SIDES = new Set(["left","right","center"]);
function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
function sameArray(a,b) { return Array.isArray(a) && Array.isArray(b) && a.length===b.length && [...a].sort().every((v,i)=>v===[...b].sort()[i]); }

/**
 * Structural preflight for planned shot metadata. It is not computer vision,
 * does not inspect rendered media, and must never be presented as output-quality scoring.
 */
export function evaluateVideoContinuityPlan(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("A video continuity plan object is required.");
  const benchmarkCase = getVideoBenchmarkCase(input.caseId);
  if (!benchmarkCase) throw new RangeError("Unknown video benchmark case.");
  if (!Array.isArray(input.shots) || input.shots.length !== benchmarkCase.shotCount) {
    throw new RangeError(`Case ${benchmarkCase.id} requires exactly ${benchmarkCase.shotCount} shots.`);
  }
  const issues = [];
  const add = (code,severity,shotNumber,message) => issues.push({code,severity,shotNumber,message});
  const seenNumbers = new Set();
  const shots = input.shots.map((shot,index)=>{
    if (!shot || typeof shot !== "object" || Array.isArray(shot)) throw new TypeError(`Shot ${index+1} must be an object.`);
    const shotNumber=shot.shotNumber;
    if (!Number.isInteger(shotNumber) || shotNumber<1 || shotNumber>12 || seenNumbers.has(shotNumber)) throw new RangeError("Shot numbers must be unique integers from 1 to 12.");
    seenNumbers.add(shotNumber);
    for (const field of benchmarkCase.required) {
      if (field==="propIds") {
        if (!Array.isArray(shot.propIds) || shot.propIds.some((v)=>!nonEmpty(v))) throw new TypeError(`Shot ${shotNumber} needs propIds.`);
      } else if (field==="actionProgress") {
        if (!Number.isFinite(shot.actionProgress)) throw new TypeError(`Shot ${shotNumber} needs numeric actionProgress.`);
      } else if (field==="transition") {
        if (!nonEmpty(shot.transition)) throw new TypeError(`Shot ${shotNumber} needs a transition description.`);
      } else if (!nonEmpty(shot[field])) throw new TypeError(`Shot ${shotNumber} needs ${field}.`);
    }
    if (shot.cameraSide !== undefined && !SIDES.has(shot.cameraSide)) throw new TypeError(`Shot ${shotNumber} has invalid cameraSide.`);
    if (shot.screenDirection !== undefined && !DIRECTIONS.has(shot.screenDirection)) throw new TypeError(`Shot ${shotNumber} has invalid screenDirection.`);
    return shot;
  }).sort((a,b)=>a.shotNumber-b.shotNumber);
  for (let i=0;i<shots.length;i++) {
    const shot=shots[i], expected=benchmarkCase.expected;
    if (shot.subjectId !== expected.subjectId) add("subject-identity","critical",shot.shotNumber,"Subject identity differs from the benchmark contract.");
    if (expected.wardrobeId && shot.wardrobeId !== expected.wardrobeId) add("wardrobe-drift","major",shot.shotNumber,"Wardrobe identity differs from the benchmark contract.");
    if (expected.propIds && !sameArray(shot.propIds,expected.propIds)) add("prop-continuity","major",shot.shotNumber,"Required props are missing, added, or changed.");
    if (expected.cameraSide && shot.cameraSide !== expected.cameraSide) add("camera-axis","major",shot.shotNumber,"Camera side differs from the planned action axis.");
    if (expected.screenDirection && shot.screenDirection !== expected.screenDirection) add("screen-direction","major",shot.shotNumber,"Screen direction differs from the planned movement direction.");
    if (shot.actionProgress !== expected.actionProgress[i]) add("temporal-progression","major",shot.shotNumber,"Action progress is out of sequence or appears to reset.");
    if (i>0 && shot.shotNumber !== shots[i-1].shotNumber+1) add("shot-gap","major",shot.shotNumber,"Shot numbering contains a gap.");
    if (i>0 && shots[i-1].cameraSide && shot.cameraSide && shots[i-1].cameraSide!==shot.cameraSide && shot.axisChangeMotivated!==true) {
      add("unmotivated-axis-change","critical",shot.shotNumber,"Camera axis changed without an explicitly motivated transition.");
    }
    if (i>0 && shots[i-1].screenDirection && shot.screenDirection && shots[i-1].screenDirection!==shot.screenDirection && shot.directionChangeMotivated!==true) {
      add("unmotivated-direction-change","major",shot.shotNumber,"Screen direction changed without an explicitly motivated transition.");
    }
  }
  const critical=issues.filter((issue)=>issue.severity==="critical").length;
  const major=issues.filter((issue)=>issue.severity==="major").length;
  const score=Math.max(0,Number((5-critical*1.5-major*0.5).toFixed(2)));
  return Object.freeze({caseId:benchmarkCase.id,category:benchmarkCase.category,shotCount:shots.length,structuralScore:score,passed:issues.length===0,issues:Object.freeze(issues),scope:"metadata-only preflight; not rendered-video or perceptual quality"});
}
