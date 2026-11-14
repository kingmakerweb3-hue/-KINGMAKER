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
      if (c.needs.food < 25) {
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
    const foodAtRisk = living.filter(c=>c.needs.food<25).length;
    return { population:living.length, averageMood, foodAtRisk, employment:living.length-(jobs.unemployed||0), jobs };
  }

  return { MAX_CITIZENS, MAX_MEMORY, JOBS, createPopulation, advanceCitizens, summarize };
});
