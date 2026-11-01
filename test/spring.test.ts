import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  projectMomentum,
  rubberband,
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
  stepSpring,
} from '../src/utils/spring';

function simulate(value: number, velocity: number, config = SPRING_DEFAULT, seconds = 2) {
  const path = [value];
  let state = { value, velocity };
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = stepSpring(state.value, state.velocity, 100, config, 1 / 60);
    path.push(state.value);
  }
  return { path, ...state };
}

describe('spring motion', () => {
  it('settles on the target from either damping regime', () => {
    for (const config of [SPRING_DEFAULT, SPRING_MOMENTUM]) {
      const end = simulate(0, 0, config);
      assert.ok(Math.abs(end.value - 100) < 0.01);
      assert.ok(Math.abs(end.velocity) < 0.1);
    }
  });

  it('never overshoots when critically damped, and does when under-damped', () => {
    assert.ok(Math.max(...simulate(0, 0, SPRING_DEFAULT).path) <= 100);
    assert.ok(Math.max(...simulate(0, 0, SPRING_MOMENTUM).path) > 100);
  });

  it('continues at the release velocity with no seam', () => {
    for (const config of [SPRING_DEFAULT, SPRING_MOMENTUM]) {
      const next = stepSpring(50, 800, 100, config, 1e-6);
      assert.ok(Math.abs(next.velocity - 800) < 1);
      assert.ok(Math.abs(next.value - 50) < 0.01);
    }
  });

  it('gives the same result however the time is divided', () => {
    const once = stepSpring(0, 300, 100, SPRING_MOMENTUM, 0.2);
    const half = stepSpring(0, 300, 100, SPRING_MOMENTUM, 0.1);
    const twice = stepSpring(half.value, half.velocity, 100, SPRING_MOMENTUM, 0.1);
    assert.ok(Math.abs(once.value - twice.value) < 1e-9);
    assert.ok(Math.abs(once.velocity - twice.velocity) < 1e-9);
  });
});

describe('momentum projection', () => {
  it('uses exponential decay, in the direction of travel', () => {
    assert.ok(Math.abs(projectMomentum(1000) - 499) < 1e-6);
    assert.equal(projectMomentum(-1000), -projectMomentum(1000));
    assert.equal(projectMomentum(0), 0);
  });
});

describe('rubberband', () => {
  it('resists progressively and keeps moving', () => {
    const near = rubberband(50, 800);
    const far = rubberband(500, 800);
    assert.ok(near < 50 && far < 500);
    assert.ok(far > near);
    assert.ok(far / 500 < near / 50);
    assert.equal(rubberband(-50, 800), -near);
  });
});
