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
