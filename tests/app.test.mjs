import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  formatClock,
  addTask,
  toggleTaskCompletion,
  recordCompletedSprint,
  computeMetrics,
} from "../src/app.js";

test("formatClock formats minutes and seconds with zero padding", () => {
  assert.equal(formatClock(1500), "25:00");
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatClock(0), "00:00");
});

test("addTask prepends a deliverable and sets activeTaskId", () => {
  const initial = createInitialState();
  const next = addTask(initial, {
    title: "Verify production telemetry",
    priority: "high",
    estimatedSprints: 3,
  });
  assert.equal(next.tasks.length, initial.tasks.length + 1);
  assert.equal(next.tasks[0].title, "Verify production telemetry");
  assert.equal(next.tasks[0].estimatedSprints, 3);
});

test("recordCompletedSprint increments sprint counters and logs session", () => {
  let state = createInitialState();
  state = recordCompletedSprint(state, "2026-10-20T12:00:00Z");
  assert.equal(state.completedSprints, 1);
  assert.equal(state.focusedMinutes, 25);
  assert.equal(state.sessions.length, 1);
  const metrics = computeMetrics(state);
  assert.equal(metrics.completedSprints, 1);
});

test("toggleTaskCompletion flips task completion status", () => {
  const initial = createInitialState();
  const taskId = initial.tasks[0].id;
  const toggled = toggleTaskCompletion(initial, taskId);
  assert.equal(toggled.tasks[0].completed, true);
});
