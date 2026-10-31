import { ScriptBlock, ScriptTimepoint } from '../../types/storia';

export interface TemporalBVHNode {
  startTimeSec: number;
  endTimeSec: number;
  blockIndex: number; // >= 0 for leaf nodes, -1 for internal bounding nodes
  blockId: string | null;
  left: TemporalBVHNode | null;
  right: TemporalBVHNode | null;
}

export interface BVHLookupResult {
  block: ScriptBlock | null;
  blockIndex: number;
  depthVisited: number;
  localTimeSec: number;
  blockProgress: number; // [0.0, 1.0]
}

export interface ActiveTimepointResult {
  timepoint: ScriptTimepoint | null;
  wordIndex: number; // >= 0 if matched a blk_{id}_w_{idx} mark, else -1
}

/**
 * 1D Temporal Bounding Volume Hierarchy (Interval Tree) over ordered ScriptBlocks.
 * Enables O(log N) playhead-to-block and O(log M) playhead-to-word lookups
 * without scanning the block array on high-refresh (60-144Hz) render ticks.
 */
export class TemporalBVH {
  private root: TemporalBVHNode | null = null;
  private blocks: ScriptBlock[] = [];
  private totalDurationSec = 0;

  constructor(blocks: ScriptBlock[] = []) {
    if (blocks.length > 0) {
      this.build(blocks);
    }
  }

  /**
   * Builds a balanced binary interval tree in O(N) time from ordered script blocks.
   */
  build(blocks: ScriptBlock[]): void {
    this.blocks = blocks;
    if (blocks.length === 0) {
      this.root = null;
      this.totalDurationSec = 0;
      return;
    }

    this.root = this.buildSubtree(0, blocks.length - 1);
    this.totalDurationSec = this.root ? this.root.endTimeSec : 0;
  }

  private buildSubtree(startIdx: number, endIdx: number): TemporalBVHNode {
    if (startIdx === endIdx) {
      const blk = this.blocks[startIdx];
      const start = blk.startTimeSec ?? 0;
      const end = blk.endTimeSec ?? start + (blk.estimatedDurationSec ?? 0);
      return {
        startTimeSec: start,
        endTimeSec: Math.max(start, end),
        blockIndex: startIdx,
        blockId: blk.id,
        left: null,
        right: null,
      };
    }

    const mid = (startIdx + endIdx) >>> 1;
    const leftNode = this.buildSubtree(startIdx, mid);
    const rightNode = this.buildSubtree(mid + 1, endIdx);

    return {
      startTimeSec: leftNode.startTimeSec,
      endTimeSec: Math.max(leftNode.endTimeSec, rightNode.endTimeSec),
      blockIndex: -1,
      blockId: null,
      left: leftNode,
      right: rightNode,
    };
  }

  getRoot(): TemporalBVHNode | null {
    return this.root;
  }

  getTotalDurationSec(): number {
    return this.totalDurationSec;
  }

  getBlockCount(): number {
    return this.blocks.length;
  }

  /**
   * Point query: locates the active ScriptBlock at `timeSec` in O(log N) time.
   */
  findBlockAtTime(timeSec: number): BVHLookupResult {
    if (!this.root || this.blocks.length === 0) {
      return {
        block: null,
        blockIndex: -1,
        depthVisited: 0,
        localTimeSec: 0,
        blockProgress: 0,
      };
    }

    const clampedTime = Math.max(0, Math.min(this.totalDurationSec, timeSec));
    let current: TemporalBVHNode | null = this.root;
    let depthVisited = 0;

    while (current) {
      depthVisited += 1;

      // Leaf node reached
      if (current.blockIndex >= 0) {
        const block = this.blocks[current.blockIndex];
        const duration = Math.max(0.001, current.endTimeSec - current.startTimeSec);
        const localTimeSec = Math.max(0, Math.min(duration, clampedTime - current.startTimeSec));
        const blockProgress = Math.max(0, Math.min(1, localTimeSec / duration));
        return {
          block,
          blockIndex: current.blockIndex,
          depthVisited,
          localTimeSec,
          blockProgress,
        };
      }

      const left: TemporalBVHNode | null = current.left;
      const right: TemporalBVHNode | null = current.right;

      if (left && clampedTime < left.endTimeSec) {
        current = left;
      } else if (right) {
        current = right;
      } else {
        current = left;
      }
    }

    return {
      block: null,
      blockIndex: -1,
      depthVisited,
      localTimeSec: 0,
      blockProgress: 0,
    };
  }

  /**
   * Binary searches `block.timepoints` in O(log M) time to identify the active SSML <mark>
   * and word index at `globalTimeSec`.
   */
  findActiveTimepoint(block: ScriptBlock, globalTimeSec: number): ActiveTimepointResult {
    const timepoints = block.timepoints;
    if (!timepoints || timepoints.length === 0) {
      return { timepoint: null, wordIndex: -1 };
    }

    const blockStart = block.startTimeSec ?? 0;
    const localTime = Math.max(0, globalTimeSec - blockStart);

    // Filter or binary-search over word timepoints
    let low = 0;
    let high = timepoints.length - 1;
    let bestIdx = 0;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (timepoints[mid].timeSeconds <= localTime) {
        bestIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // If bestIdx landed on `start_...` and the very next mark is word 0 at t=0, prefer the word mark
    let chosen = timepoints[bestIdx];
    if (
      chosen.markName.startsWith('start_') &&
      bestIdx + 1 < timepoints.length &&
      timepoints[bestIdx + 1].timeSeconds <= localTime + 0.001
    ) {
      chosen = timepoints[bestIdx + 1];
    }

    const wordMatch = /_w_(\d+)$/.exec(chosen.markName);
    const wordIndex = wordMatch ? parseInt(wordMatch[1], 10) : -1;

    return {
      timepoint: chosen,
      wordIndex,
    };
  }

  /**
   * Range query: returns all ScriptBlocks overlapping [minTimeSec, maxTimeSec] in O(log N + K) time.
   */
  queryRange(minTimeSec: number, maxTimeSec: number): ScriptBlock[] {
    const results: ScriptBlock[] = [];
    if (!this.root || maxTimeSec < minTimeSec) return results;

    this.collectRange(this.root, minTimeSec, maxTimeSec, results);
    return results;
  }

  private collectRange(
    node: TemporalBVHNode,
    minTime: number,
    maxTime: number,
    out: ScriptBlock[]
  ): void {
    // Disjoint interval check
    if (node.endTimeSec < minTime || node.startTimeSec > maxTime) {
      return;
    }

    if (node.blockIndex >= 0) {
      out.push(this.blocks[node.blockIndex]);
      return;
    }

    if (node.left) {
      this.collectRange(node.left, minTime, maxTime, out);
    }
    if (node.right) {
      this.collectRange(node.right, minTime, maxTime, out);
    }
  }
}

