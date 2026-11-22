"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/citizens.js");

test("population generation is deterministic and bounded", () => {
  const a=C.createPopulation(8,"alpha"), b=C.createPopulation(8,"alpha");
  assert.deepEqual(a,b);
  assert.equal(C.createPopulation(99999).length,C.MAX_CITIZENS);
  assert.equal(C.createPopulation(-2).length,0);
});

test("citizens respond to food, stability, housing and services", () => {
  const people=C.createPopulation(3,"test");
  const result=C.advanceCitizens(people,{turn:1,foodPerCitizen:0,housingAvailable:false,stability:20,communityServices:false});
  assert.equal(result.summary.population,3);
  assert.equal(result.summary.foodAtRisk,3);
  assert.ok(result.events.length>=3);
  assert.ok(people.every(p=>p.memory.length>0));
});

test("unemployed citizens can accept available jobs", () => {
  const people=C.createPopulation(1,"employment");
  people[0].job="unemployed";
  const result=C.advanceCitizens(people,{turn:2,jobs:{farmer:1}});
  assert.equal(result.summary.employment,1);
  assert.equal(people[0].job,"farmer");
});

test("citizen memories are bounded", () => {
  const p=C.createPopulation(1,"memory")[0];
  for(let turn=1;turn<=30;turn++) C.advanceCitizens([p],{turn,foodPerCitizen:0});
  assert.equal(p.memory.length,C.MAX_MEMORY);
});


test("home-island pathfinding routes around buildings and stays inside safe terrain", () => {
  const start = { x: -4, z: 0 }, goal = { x: 4, z: 0 };
  const options = { radius: 11.5, step: 0.5, clearance: 0.2, obstacles: [{ x: 0, z: 0, radius: 1.8 }] };
  const path = C.findHomeIslandPath(start, goal, options);
  assert.ok(Array.isArray(path) && path.length > 1);
  assert.deepEqual(path.at(-1), goal);
  for (const point of path) {
    assert.ok(Math.hypot(point.x, point.z) <= 11.5);
    assert.ok(Math.hypot(point.x, point.z) >= 1.98);
  }
  assert.deepEqual(C.findHomeIslandPath(start, goal, options), path);
});

test("home-island pathfinding prefers safe roads and rejects blocked or out-of-bounds targets", () => {
  const start = { x: -4, z: 0 }, goal = { x: 4, z: 0 };
  const obstacles = [{ x: 0, z: 0, radius: 1.6 }];
  const plain = C.findHomeIslandPath(start, goal, { obstacles });
  const road = C.findHomeIslandPath(start, goal, {
    obstacles,
    roads: [{ from: { x: -4, z: 3 }, to: { x: 4, z: 3 } }]
  });
  assert.ok(plain && road);
  assert.ok(road.length > 0);
  assert.equal(C.findHomeIslandPath(start, { x: 0, z: 0 }, { obstacles }), null);
  assert.equal(C.findHomeIslandPath(start, { x: 12, z: 0 }), null);
});
