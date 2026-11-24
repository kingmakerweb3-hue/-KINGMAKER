(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KingmakerCitizens = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CITIZENS = 5000;
  const MAX_MEMORY = 12;
  const JOBS = ["farmer", "builder", "miner", "maker", "merchant", "researcher", "medic", "unemployed"];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  const hash = value => { let h=2166136261; for (const c of String(value)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; };
  const pick = (list, seed) => list[seed % list.length];

  function createPopulation(population, seed = "kingmaker") {
    const count = clamp(Math.floor(population), 0, MAX_CITIZENS);
    return Array.from({ length: count }, (_, i) => {
      const id = "citizen-" + (i + 1);
      const h = hash(seed + ":" + id);
      return {
        id, name: pick(["Ari","Mira","Noah","Leila","Samir","Nora","Elias","Zara","Omar","Lina"], h),
        age: 18 + (h % 53), homeDistrict: pick(["residential","commercial","industrial","agricultural"], h >>> 4),
        job: pick(JOBS, h >>> 8), skills: { farming: h%6, craft: (h>>>3)%6, trade:(h>>>6)%6, science:(h>>>9)%6 },
        needs: { food: 65+(h%25), shelter: 60+((h>>>5)%30), safety: 70+((h>>>10)%25), belonging: 45+((h>>>15)%45) },
        mood: 60+(h%31), memory: [], lastDecision: "Settled into daily life", alive: true
      };
    });
  }

  function remember(citizen, turn, text) {
    citizen.memory.unshift({ turn, text: String(text).slice(0, 160) });
    citizen.memory.length = Math.min(citizen.memory.length, MAX_MEMORY);
  }

  function advanceCitizens(citizens, context = {}) {
    if (!Array.isArray(citizens)) throw new TypeError("citizens must be an array");
    const turn = Math.max(0, Math.floor(context.turn || 0));
    const food = clamp(context.foodPerCitizen ?? 1, 0, 3);
    const jobs = context.jobs || {};
    const events = [];
    for (const c of citizens) {
      if (!c || c.alive === false) continue;
      const before = c.job;
      if (before === "unemployed") {
        const openings = JOBS.filter(j => j !== "unemployed" && (jobs[j] || 0) > 0);
        if (openings.length) {
          c.job = pick(openings, hash(c.id + ":" + turn));
          jobs[c.job] = Math.max(0, (jobs[c.job] || 0) - 1);
          c.lastDecision = "Accepted work as " + c.job;
          remember(c, turn, c.lastDecision);
          events.push({ citizenId:c.id, type:"employment", detail:c.lastDecision });
        }
      }
      c.needs.food = clamp(c.needs.food - 12 + food*12, 0, 100);
      c.needs.shelter = clamp(c.needs.shelter + (context.housingAvailable ? 2 : -2), 0, 100);
      c.needs.safety = clamp(c.needs.safety + (context.stability >= 65 ? 2 : -4), 0, 100);
      c.needs.belonging = clamp(c.needs.belonging + (context.communityServices ? 3 : -1), 0, 100);
      const average = Object.values(c.needs).reduce((a,b)=>a+b,0)/4;
      c.mood = Math.round(clamp(average, 0, 100));
      if (food === 0 || c.needs.food < 25) {
        c.lastDecision = "Searched for food";
        remember(c, turn, "Food shortage affected daily life");
        events.push({ citizenId:c.id, type:"shortage", detail:c.lastDecision });
      } else if (c.mood < 40) {
        c.lastDecision = "Considered relocating";
        if (turn % 3 === 0) remember(c, turn, "Low quality of life; considered relocating");
      } else if (before !== c.job) {
        // Employment decision was already recorded above.
      } else {
        c.lastDecision = "Worked as " + c.job;
      }
    }
    return { citizens, events, summary: summarize(citizens) };
  }

  function summarize(citizens) {
    const living = citizens.filter(c => c && c.alive !== false);
    const jobs = {};
    for (const c of living) jobs[c.job] = (jobs[c.job] || 0) + 1;
    const averageMood = living.length ? Math.round(living.reduce((n,c)=>n+c.mood,0)/living.length) : 0;
    const foodAtRisk = living.filter(c=>c.needs.food<25 || c.lastDecision === "Searched for food").length;
    return { population:living.length, averageMood, foodAtRisk, employment:living.length-(jobs.unemployed||0), jobs };
  }


  function findHomeIslandPath(start, goal, options = {}) {
    const radius = clamp(options.radius ?? 11.5, 3, 16);
    const step = clamp(options.step ?? 0.5, 0.25, 1);
    const clearance = clamp(options.clearance ?? 0.22, 0, 1.5);
    const center = options.center && Number.isFinite(options.center.x) && Number.isFinite(options.center.z) ? { x: options.center.x, z: options.center.z } : { x: 0, z: 0 };
    const validPoint = point => !!point && Number.isFinite(point.x) && Number.isFinite(point.z) && Math.hypot(point.x - center.x, point.z - center.z) <= radius;
    if (!validPoint(start) || !validPoint(goal)) return null;

    const obstacles = (Array.isArray(options.obstacles) ? options.obstacles : [])
      .filter(item => item && Number.isFinite(item.x) && Number.isFinite(item.z))
      .map(item => ({ x: item.x, z: item.z, radius: clamp(item.radius ?? 0.7, 0.1, 4) }));
    if (obstacles.some(item => Math.hypot(goal.x - item.x, goal.z - item.z) < item.radius + clearance)) return null;

    const roads = (Array.isArray(options.roads) ? options.roads : [])
      .filter(road => road?.from && road?.to &&
        [road.from.x, road.from.z, road.to.x, road.to.z].every(Number.isFinite));
    const heightAt = typeof options.heightAt === "function" ? options.heightAt : null;
    const toCell = point => ({ x: Math.round(point.x / step), z: Math.round(point.z / step) });
    const toPoint = cell => ({ x: Number((cell.x * step).toFixed(3)), z: Number((cell.z * step).toFixed(3)) });
    const keyOf = (x, z) => x + "," + z;
    const startCell = toCell(start);
    const startKey = keyOf(startCell.x, startCell.z);

    const isWalkable = (x, z, allowStart = false) => {
      if (Math.hypot(x * step - center.x, z * step - center.z) > radius + 1e-6) return false;
      if (allowStart) return true;
      const point = { x: x * step, z: z * step };
      return !obstacles.some(item => Math.hypot(point.x - item.x, point.z - item.z) < item.radius + clearance);
    };

    const goalBase = toCell(goal);
    let goalCell = null;
    let goalDistance = Infinity;
    for (let ring = 0; ring <= 3; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const x = goalBase.x + dx, z = goalBase.z + dz;
          if (!isWalkable(x, z)) continue;
          const point = toPoint({ x, z });
          const distance = Math.hypot(point.x - goal.x, point.z - goal.z);
          if (distance < goalDistance) { goalDistance = distance; goalCell = { x, z }; }
        }
      }
      if (goalCell && goalDistance <= step * 0.72) break;
    }
    if (!goalCell) return null;
    const goalKey = keyOf(goalCell.x, goalCell.z);
    const heuristic = (x, z) => {
      const dx = Math.abs(goalCell.x - x), dz = Math.abs(goalCell.z - z);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    const pointSegmentDistanceSquared = (point, a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared ? clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1) : 0;
      const x = a.x + dx * t, z = a.z + dz * t;
      return (point.x - x) ** 2 + (point.z - z) ** 2;
    };
    const nearRoad = point => roads.some(road =>
      pointSegmentDistanceSquared(point, road.from, road.to) <= 0.55 * 0.55);
    const directions = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    const heap = [];
    const compare = (a, b) => a.f - b.f || a.h - b.h;
    const push = node => {
      let index = heap.length;
      heap.push(node);
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (compare(heap[parent], node) <= 0) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = node;
    };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1, right = left + 1;
          if (left >= heap.length) break;
          let child = left;
          if (right < heap.length && compare(heap[right], heap[left]) < 0) child = right;
          if (compare(heap[child], last) >= 0) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    };

    const cameFrom = new Map();
    const scores = new Map([[startKey, 0]]);
    const closed = new Set();
    const startH = heuristic(startCell.x, startCell.z);
    push({ x: startCell.x, z: startCell.z, key: startKey, g: 0, h: startH, f: startH });
    let found = false, visited = 0;
    while (heap.length && visited < 12000) {
      const current = pop();
      if (closed.has(current.key) || current.g !== scores.get(current.key)) continue;
      if (current.key === goalKey) { found = true; break; }
      closed.add(current.key);
      visited++;
      for (const [dx, dz] of directions) {
        const x = current.x + dx, z = current.z + dz, key = keyOf(x, z);
        if (closed.has(key) || !isWalkable(x, z, key === startKey)) continue;
        if (dx && dz && (!isWalkable(current.x + dx, current.z, keyOf(current.x + dx, current.z) === startKey) ||
            !isWalkable(current.x, current.z + dz, keyOf(current.x, current.z + dz) === startKey))) continue;
        const from = toPoint(current), to = toPoint({ x, z });
        let cost = dx && dz ? Math.SQRT2 : 1;
        if (nearRoad(to)) cost *= 0.82;
        if (heightAt) {
          const rise = Math.abs(Number(heightAt(to.x, to.z)) - Number(heightAt(from.x, from.z)));
          if (Number.isFinite(rise)) cost += Math.min(1.5, rise * 1.4);
        }
        const candidate = current.g + cost;
        if (candidate >= (scores.get(key) ?? Infinity)) continue;
        cameFrom.set(key, current.key);
        scores.set(key, candidate);
        const h = heuristic(x, z);
        push({ x, z, key, g: candidate, h, f: candidate + h });
      }
    }
    if (!found) return null;

    const cells = [];
    let cursor = goalKey;
    while (cursor !== startKey) {
      const [x, z] = cursor.split(",").map(Number);
      cells.push({ x, z });
      cursor = cameFrom.get(cursor);
      if (!cursor || cells.length > 12000) return null;
    }
    cells.reverse();
    const path = cells.map(toPoint);
    if (!path.length || Math.hypot(path[path.length - 1].x - goal.x, path[path.length - 1].z - goal.z) > 0.04) {
      path.push({ x: Number(goal.x.toFixed(3)), z: Number(goal.z.toFixed(3)) });
    } else {
      path[path.length - 1] = { x: Number(goal.x.toFixed(3)), z: Number(goal.z.toFixed(3)) };
    }

    const lineClear = (a, b) => {
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      const samples = Math.max(2, Math.ceil(distance / (step * 0.35)));
      for (let index = 1; index <= samples; index++) {
        const t = index / samples;
        const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
        if (Math.hypot(point.x - center.x, point.z - center.z) > radius) return false;
        if (t > 0.15 && obstacles.some(item =>
          Math.hypot(point.x - item.x, point.z - item.z) < item.radius + clearance)) return false;
      }
      return true;
    };
    const smooth = [];
    let anchor = { x: start.x, z: start.z }, index = 0;
    while (index < path.length) {
      let farthest = index;
      for (let candidate = path.length - 1; candidate >= index; candidate--) {
        if (lineClear(anchor, path[candidate])) { farthest = candidate; break; }
      }
      smooth.push(path[farthest]);
      anchor = path[farthest];
      index = farthest + 1;
    }
    return smooth;
  }

  function findTerritoryPath(start, goal, options = {}) { return findHomeIslandPath(start, goal, options); }
  return { MAX_CITIZENS, MAX_MEMORY, JOBS, createPopulation, advanceCitizens, summarize, findHomeIslandPath, findTerritoryPath };
});
