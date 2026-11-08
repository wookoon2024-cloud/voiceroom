/** Collision-aware navigation in normalized map coordinates. No rendering or network state. */
export type WalkPoint = { x: number; y: number };
export type BlockedPoint = (point: WalkPoint) => boolean;
const COLS = 96;
const ROWS = 60;
export const walkDistance = (a: WalkPoint, b: WalkPoint) => Math.hypot((a.x - b.x) * 1.6, a.y - b.y);

export function clearWalkSegment(from: WalkPoint, to: WalkPoint, blocked: BlockedPoint): boolean {
  // Sample at less than a foot radius, including both ends, so thin furniture cannot be crossed.
  const steps = Math.max(1, Math.ceil(walkDistance(from, to) / 0.004));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (blocked({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })) return false;
  }
  return true;
}

/** Returns waypoints AFTER from, ending at the exact requested point; null means unreachable. */
export function findWalkPath(from: WalkPoint, to: WalkPoint, blocked: BlockedPoint): WalkPoint[] | null {
  if (blocked(from) || blocked(to)) return null;
  if (clearWalkSegment(from, to, blocked)) return [{ ...to }];
  const width = COLS + 1;
  const point = (id: number) => ({ x: (id % width) / COLS, y: Math.floor(id / width) / ROWS });
  const cell = (p: WalkPoint) => Math.round(p.y * ROWS) * width + Math.round(p.x * COLS);
  const count = width * (ROWS + 1);
  const passable = new Int8Array(count);
  const canPass = (id: number) => {
    if (!passable[id]) passable[id] = blocked(point(id)) ? -1 : 1;
    return passable[id] > 0;
  };
  // A rounded grid node may be inside a prop while the exact endpoint is outside it.
  const endpoint = (p: WalkPoint) => {
    const base = cell(p), bx = base % width, by = Math.floor(base / width);
    let best = -1, distance = Infinity;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = bx + dx, y = by + dy;
      if (x < 0 || x > COLS || y < 0 || y > ROWS) continue;
      const id = y * width + x, d = walkDistance(p, point(id));
      if (d < distance && canPass(id) && clearWalkSegment(p, point(id), blocked)) { best = id; distance = d; }
    }
    return best;
  };
  const start = endpoint(from), goal = endpoint(to);
  if (start < 0 || goal < 0) return null;
  const cost = new Float64Array(count).fill(Infinity);
  const previous = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const open: { id: number; priority: number }[] = [];
  const push = (entry: { id: number; priority: number }) => {
    open.push(entry); let i = open.length - 1;
    while (i > 0) { const parent = (i - 1) >> 1; if (open[parent].priority <= entry.priority) break; open[i] = open[parent]; i = parent; }
    open[i] = entry;
  };
  const pop = () => {
    const first = open[0], last = open.pop()!;
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let child = i * 2 + 1;
        if (child + 1 < open.length && open[child + 1].priority < open[child].priority) child++;
        if (last.priority <= open[child].priority) break;
        open[i] = open[child]; i = child;
      }
      open[i] = last;
    }
    return first;
  };
  cost[start] = 0; push({ id: start, priority: walkDistance(point(start), to) });
  while (open.length) {
    const current = pop().id;
    if (closed[current]) continue;
    if (current === goal) {
      const reversed: WalkPoint[] = [to];
      let at = goal;
      while (at !== start && at >= 0) { reversed.push(point(at)); at = previous[at]; }
      reversed.push(point(start));
      const path = [from, ...reversed.reverse()];
      const result: WalkPoint[] = [];
      let cursor = 0;
      while (cursor < path.length - 1) {
        let next = path.length - 1;
        while (next > cursor + 1 && !clearWalkSegment(path[cursor], path[next], blocked)) next--;
        result.push(path[next]); cursor = next;
      }
      return result;
    }
    closed[current] = 1;
    const x = current % width, y = Math.floor(current / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > COLS || ny < 0 || ny > ROWS) continue;
      const next = ny * width + nx;
      if (closed[next] || !canPass(next) || !clearWalkSegment(point(current), point(next), blocked)) continue;
      const nextCost = cost[current] + walkDistance(point(current), point(next));
      if (nextCost >= cost[next]) continue;
      cost[next] = nextCost; previous[next] = current;
      push({ id: next, priority: nextCost + walkDistance(point(next), to) });
    }
  }
  return null;
}

export function walkPathLength(from: WalkPoint, path: WalkPoint[]) {
  let length = 0, last = from;
  for (const p of path) { length += walkDistance(last, p); last = p; }
  return length;
}
