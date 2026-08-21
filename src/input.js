export const keys = new Set();
let bound = false;

export function bindInput() {
  if (bound) return;
  bound = true;
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.key) keys.add(e.key.toLowerCase());
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyQ"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (e.key) keys.delete(e.key.toLowerCase());
  });
  window.addEventListener("blur", () => keys.clear());
}

export function axis() {
  let x = 0;
  let y = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
  const m = Math.hypot(x, y);
  if (m > 0) {
    x /= m;
    y /= m;
  }
  return { x, y };
}
