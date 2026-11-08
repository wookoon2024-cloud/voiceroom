import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const cache = new Map();
function load(file) {
  let resolved = file;
  if (!path.extname(resolved)) resolved = [".ts", ".tsx", ".json"].map(ext => file + ext).find(p => fs.existsSync(p));
  if (cache.has(resolved)) return cache.get(resolved).exports;
  if (resolved.endsWith(".json")) return JSON.parse(fs.readFileSync(resolved, "utf8"));
  const module = { exports: {} }; cache.set(resolved, module);
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
  const localRequire = name => name.startsWith("@/") ? load(path.join(root, name.slice(2))) : name.startsWith(".") ? load(path.resolve(path.dirname(resolved), name)) : require(name);
  vm.runInNewContext(code, {module,exports:module.exports,require:localRequire,console,setInterval,clearInterval}, {filename:resolved});
  return module.exports;
}
const nav = load(path.join(root, "lib/plaza-navigation.ts"));
const plaza = load(path.join(root, "lib/plaza.tsx"));
const { GARDEN_LOUNGE_THEME: theme } = load(path.join(root, "lib/garden-lounge.ts"));
const blocked = p => {const c=plaza.clampPlazaPos(p);return c.x!==p.x||c.y!==p.y||plaza.isBlockedInTheme(p.x,p.y,theme)};
const cases = [
  ["open plaza",{x:.33,y:.6},{x:.67,y:.6},false],
  ["around the pool",{x:.50,y:.28},{x:.50,y:.64},true],
  ["around the deck bench",{x:.24,y:.21},{x:.24,y:.40},true],
  ["around a lower bench",{x:.30,y:.72},{x:.30,y:.94},true],
];
const results=[];
for (const [name,from,to,detour] of cases) {
  const route=nav.findWalkPath(from,to,blocked);
  assert.ok(route?.length,`${name}: reachable`);
  if(detour) assert.ok(route.length>1,`${name}: must detour`);
  let last=from;
  for(const next of route){assert.ok(nav.clearWalkSegment(last,next,blocked),`${name}: clear segment`);last=next}
  assert.ok(nav.walkDistance(last,to)<1e-9,`${name}: exact destination`);
  results.push({name,waypoints:route.length,length:nav.walkPathLength(from,route)});
}
assert.equal(nav.findWalkPath({x:.33,y:.6},{x:.5,y:.44},blocked),null,"pool destination is blocked");
assert.equal(nav.findWalkPath({x:.2,y:.5},{x:.8,y:.5},p=>p.x>.45&&p.x<.55),null,"an impassable wall is unreachable");
assert.equal(blocked({x:.10,y:.14}),false,"tree canopy does not block ground");
assert.equal(blocked({x:.108,y:.30}),true,"tree trunk blocks feet");
for(let slot=0;slot<10;slot++) assert.equal(blocked(plaza.defaultPlazaPos(slot,"garden_lounge")),false,`spawn ${slot} is clear`);
assert.equal(theme.props.length,9);
assert.ok(theme.props.every(p=>p.anchorY>=p.y&&p.anchorY<=p.y+p.h&&p.cols.length>0));
const evidence=path.join(root,"sprites_run/garden-v3/walk-evidence.json");
if(fs.existsSync(evidence)) {
  const observed=JSON.parse(fs.readFileSync(evidence,"utf8"));
  assert.ok(observed.samples.every(p=>!blocked(p)),"browser route never enters a collision footprint");
  assert.ok(nav.walkDistance(observed.arrived,observed.target)<.003,"browser reaches exact far destination");
  assert.ok(nav.walkDistance(observed.arrived,observed.blocked)<.001,"clicking pool does not move actor into it");
  assert.ok(observed.blockedNotice?.includes("이동할 수 없는"),"blocked destination has a user message");
  results.push({name:"actual browser route and pool blocking",samples:observed.samples.length});
}
const report={ok:true,cases:results,checks:["blocked pool","unreachable wall","canopy walkability","trunk collision","10 safe spawns","9 depth-sorted props"]};
fs.mkdirSync(path.join(root,"sprites_run/garden-v3"),{recursive:true});
fs.writeFileSync(path.join(root,"sprites_run/garden-v3/navigation-check.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
