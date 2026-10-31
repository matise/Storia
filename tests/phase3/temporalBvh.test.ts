import { describe, expect, it } from 'vitest';
import { TemporalBVH } from '../../src/core/spatial/TemporalBVH';
import { ScriptBlock } from '../../src/types/storia';

describe('Phase 3 — 1D Temporal Bounding Volume Hierarchy (Interval Tree)', () => {
  it('constructs a balanced 1D BVH over N=1,000 blocks and resolves point queries in O(log N) depth (<= 11 comparisons)', () => {
    const N = 1000;
    const blockDuration = 5.0; // Each block spans 5.0 seconds -> total 5,000s
    const blocks: ScriptBlock[] = Array.from({ length: N }, (_, i) => ({
      id: `blk_${i}`,
      type: 'dialogue',
      speakerId: 'spk_marko',
      text: `Dialogue line #${i}`,
      startTimeSec: i * blockDuration,
      endTimeSec: (i + 1) * blockDuration,
      estimatedDurationSec: blockDuration,
      order: i,
    }));

    const bvh = new TemporalBVH(blocks);
    expect(bvh.getBlockCount()).toBe(1000);
    expect(bvh.getTotalDurationSec()).toBe(5000);

    // Probe 250 timestamps across the 5,000-second timeline
    for (let probe = 0; probe < 250; probe++) {
      const t = (probe / 250) * 4999.9;
      const expectedIdx = Math.floor(t / blockDuration);
      const hit = bvh.findBlockAtTime(t);

      expect(hit.block).not.toBeNull();
      expect(hit.blockIndex).toBe(expectedIdx);
      expect(hit.block!.id).toBe(`blk_${expectedIdx}`);
      // Binary tree of 1,000 leaves has max depth ceil(log2(1000)) + 1 = 11
      expect(hit.depthVisited).toBeLessThanOrEqual(11);
    }
  });

  it('binary-searches SSML word timepoints in O(log M) time via findActiveTimepoint', () => {
    const block: ScriptBlock = {
      id: 'blk_karaoke',
      type: 'dialogue',
      speakerId: 'spk_ana',
      text: 'To su samo sjene Marko',
      startTimeSec: 10.0,
      endTimeSec: 15.0,
      estimatedDurationSec: 5.0,
      order: 0,
      timepoints: [
        { markName: 'start_blk_karaoke', timeSeconds: 0.0 },
        { markName: 'blk_karaoke_w_0', timeSeconds: 0.0 },
        { markName: 'blk_karaoke_w_1', timeSeconds: 1.0 },
        { markName: 'blk_karaoke_w_2', timeSeconds: 2.0 },
        { markName: 'blk_karaoke_w_3', timeSeconds: 3.0 },
        { markName: 'blk_karaoke_w_4', timeSeconds: 4.0 },
        { markName: 'end_blk_karaoke', timeSeconds: 5.0 },
      ],
    };

    const bvh = new TemporalBVH([block]);

    expect(bvh.findActiveTimepoint(block, 10.2).wordIndex).toBe(0);
    expect(bvh.findActiveTimepoint(block, 11.4).wordIndex).toBe(1);
    expect(bvh.findActiveTimepoint(block, 12.8).wordIndex).toBe(2);
    expect(bvh.findActiveTimepoint(block, 13.5).wordIndex).toBe(3);
    expect(bvh.findActiveTimepoint(block, 14.2).wordIndex).toBe(4);
  });

  it('returns only overlapping blocks for viewport range queries via queryRange(minTime, maxTime)', () => {
    const blocks: ScriptBlock[] = Array.from({ length: 100 }, (_, i) => ({
      id: `blk_${i}`,
      type: 'dialogue',
      text: `Line ${i}`,
      startTimeSec: i * 10,
      endTimeSec: (i + 1) * 10,
      estimatedDurationSec: 10,
      order: i,
    }));

    const bvh = new TemporalBVH(blocks);
    // Query [125s, 155s] -> should overlap blk_12 [120,130], blk_13 [130,140], blk_14 [140,150], blk_15 [150,160]
    const overlapping = bvh.queryRange(125, 155);
    expect(overlapping.map((b) => b.id)).toEqual(['blk_12', 'blk_13', 'blk_14', 'blk_15']);
  });
});

