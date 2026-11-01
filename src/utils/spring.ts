/**
 * Interruptible spring motion for anything the user can grab.
 *
 * Parameters follow Apple's designer-facing pair rather than mass and stiffness:
 * `damping` is the ratio (1 settles without overshoot, below 1 bounces) and
 * `response` is roughly how long the value takes to reach the target, in seconds.
 */
export interface SpringConfig {
  damping: number;
  response: number;
}

/** No overshoot: the default for motion the user did not throw. */
export const SPRING_DEFAULT: SpringConfig = { damping: 1, response: 0.35 };
/** Slight bounce: only earned when the gesture itself carried momentum. */
export const SPRING_MOMENTUM: SpringConfig = { damping: 0.8, response: 0.3 };

const SETTLE_DISTANCE = 0.1;
const SETTLE_VELOCITY = 2;
/** Tolerates slow frames without slow motion, but a stalled tab does not leap ahead. */
const MAX_FRAME_SECONDS = 0.1;

/** Exact solution of the spring after `dt` seconds, so step size cannot destabilise it. */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  { damping, response }: SpringConfig,
  dt: number,
): { value: number; velocity: number } {
  const omega = (2 * Math.PI) / response;
  const offset = value - target;

  if (damping >= 1) {
    const a = velocity + omega * offset;
    const decay = Math.exp(-omega * dt);
    return {
      value: target + (offset + a * dt) * decay,
      velocity: (velocity - a * omega * dt) * decay,
    };
  }

  const damped = omega * Math.sqrt(1 - damping * damping);
  const rate = damping * omega;
  const b = (velocity + rate * offset) / damped;
  const decay = Math.exp(-rate * dt);
  const cos = Math.cos(damped * dt);
  const sin = Math.sin(damped * dt);
  return {
    value: target + decay * (offset * cos + b * sin),
    velocity: decay * ((b * damped - rate * offset) * cos - (offset * damped + rate * b) * sin),
  };
}

/** Where a flick would come to rest, using scroll-style exponential deceleration. */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary; approaches `dimension * constant` but never stops dead. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * A value animated towards a target. Retargeting mid-flight starts from the
 * on-screen value and keeps its velocity, so motion never jumps or hits a wall.
 */
export class Spring {
  value: number;
  velocity = 0;
  private frame = 0;
  private readonly onUpdate: (value: number) => void;

  constructor(initial: number, onUpdate: (value: number) => void) {
    this.value = initial;
    this.onUpdate = onUpdate;
  }

  /** Follows a direct input such as a drag, cancelling any motion in flight. */
  set(value: number): void {
    this.stop();
    this.value = value;
    this.velocity = 0;
    this.onUpdate(value);
  }

  to(target: number, config: SpringConfig = SPRING_DEFAULT, velocity = this.velocity): void {
    this.stop();
    this.velocity = velocity;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;
      const next = stepSpring(this.value, this.velocity, target, config, dt);
      this.value = next.value;
      this.velocity = next.velocity;

      if (
        Math.abs(next.value - target) < SETTLE_DISTANCE &&
        Math.abs(next.velocity) < SETTLE_VELOCITY
      ) {
        this.value = target;
        this.velocity = 0;
        this.frame = 0;
        this.onUpdate(target);
        return;
      }
      this.onUpdate(next.value);
      this.frame = requestAnimationFrame(tick);
    };

    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
