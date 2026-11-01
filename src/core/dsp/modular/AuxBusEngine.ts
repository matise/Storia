import {
  AudioEffectConfig,
  AuxBusConfig,
  createDefaultMainAuxBus,
} from '../../../types/storia';
import {
  createAudioEffectModule,
  IAudioEffectModule,
} from './AudioEffectModule';

/**
 * Manages an Aux Send Bus and its internal chain of modular audio effects.
 *
 * Routing topology:
 * [Aux Input] ---> [Module 0] ---> [Module 1] ---> ... ---> [Module N] ---> [Return Gain] ---> [Master Output]
 *                        │               │
 *                        ▼ (Bypass)      ▼ (Bypass)
 *                  Direct Audio Sync (bit-transparent passthrough)
 */
export class AuxBusEngine {
  public readonly id: string;
  public name: string;
  public color: string;

  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;
  private readonly returnGainNode: GainNode;
  private readonly masterBypassDryGain: GainNode;
  private readonly masterBypassWetGain: GainNode;
  private readonly ctx: BaseAudioContext;

  private modules: IAudioEffectModule[] = [];
  private enabled: boolean;
  private returnGainDb: number;

  constructor(ctx: BaseAudioContext, config: AuxBusConfig = createDefaultMainAuxBus()) {
    this.ctx = ctx;
    this.id = config.id;
    this.name = config.name;
    this.color = config.color ?? '#10b981';
    this.enabled = config.enabled ?? true;
    this.returnGainDb = config.returnGainDb ?? 0.0;

    // 1. Bus Master Input Node
    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1.0;

    // 2. Bus Master Return Gain Node (controls wet return level)
    this.returnGainNode = ctx.createGain();
    this.setReturnGainDb(this.returnGainDb, true);

    // 3. Master Bypass Switch Nodes (Direct Audio Sync for entire bus)
    this.masterBypassDryGain = ctx.createGain();
    this.masterBypassWetGain = ctx.createGain();
    this.masterBypassDryGain.gain.value = this.enabled ? 0.0 : 1.0;
    this.masterBypassWetGain.gain.value = this.enabled ? 1.0 : 0.0;

    // 4. Bus Master Output Node (connects to Master Limiter / Internal Mixer)
    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 1.0;

    // Direct dry bypass connection (when entire bus is disabled)
    this.inputNode.connect(this.masterBypassDryGain);
    this.masterBypassDryGain.connect(this.outputNode);

    // Wet return connection
    this.returnGainNode.connect(this.masterBypassWetGain);
    this.masterBypassWetGain.connect(this.outputNode);

    // 5. Instantiate and link effect modules
    this.rebuildModuleChain(config.modules ?? []);
  }

  /**
   * Reconstructs the internal series connection between effect modules.
   */
  public rebuildModuleChain(moduleConfigs: AudioEffectConfig[]): void {
    // Clean up existing modules
    this.disposeModules();

    this.modules = moduleConfigs.map((cfg) => createAudioEffectModule(this.ctx, cfg));

    if (this.modules.length === 0) {
      // Empty chain: connect input straight to return gain
      this.inputNode.connect(this.returnGainNode);
      return;
    }

    // Connect input -> module[0]
    this.inputNode.connect(this.modules[0].inputNode);

    // Connect module[i] -> module[i+1]
    for (let i = 0; i < this.modules.length - 1; i++) {
      this.modules[i].outputNode.connect(this.modules[i + 1].inputNode);
    }

    // Connect module[last] -> returnGainNode
    this.modules[this.modules.length - 1].outputNode.connect(this.returnGainNode);
  }

  /**
   * Returns all active module instances.
   */
  public getModules(): readonly IAudioEffectModule[] {
    return this.modules;
  }

  /**
   * Finds a specific effect module by ID.
   */
  public getModule(moduleId: string): IAudioEffectModule | undefined {
    return this.modules.find((m) => m.id === moduleId);
  }

  /**
   * Updates configuration for an existing effect module dynamically.
   */
  public updateModuleConfig(
    moduleId: string,
    config: AudioEffectConfig,
    immediate = false
  ): boolean {
    const mod = this.getModule(moduleId);
    if (!mod) return false;
    mod.applyConfig(config, immediate);
    return true;
  }

  /**
   * Toggles bypass for an individual effect module in the chain (Direct Audio Sync).
   */
  public toggleModuleEnabled(moduleId: string, immediate = false): boolean {
    const mod = this.getModule(moduleId);
    if (!mod) return false;
    const next = !mod.isEnabled();
    mod.setEnabled(next, immediate);
    return next;
  }

  /**
   * Explicitly sets bypass for an individual effect module in the chain.
   */
  public setModuleEnabled(moduleId: string, enabled: boolean, immediate = false): boolean {
    const mod = this.getModule(moduleId);
    if (!mod) return false;
    mod.setEnabled(enabled, immediate);
    return enabled;
  }

  /**
   * Retrieves an effect module's declarative configuration.
   */
  public getModuleConfig(moduleId: string): AudioEffectConfig | undefined {
    return this.getModule(moduleId)?.getConfig();
  }

  /**
   * Appends an effect module to the end of this Aux Bus chain.
   */
  public addModule(config: AudioEffectConfig): void {
    const newConfigs = [...this.modules.map((m) => m.getConfig()), config];
    this.rebuildModuleChain(newConfigs);
  }

  /**
   * Removes an effect module from this Aux Bus chain.
   */
  public removeModule(moduleId: string): void {
    const newConfigs = this.modules
      .filter((m) => m.id !== moduleId)
      .map((m) => m.getConfig());
    this.rebuildModuleChain(newConfigs);
  }

  /**
   * Toggles or sets master bypass for the entire Aux Bus.
   */
  public setEnabled(enabled: boolean, immediate = false): void {
    this.enabled = enabled;
    const now = this.ctx.currentTime;
    const dry = enabled ? 0.0 : 1.0;
    const wet = enabled ? 1.0 : 0.0;

    if (immediate || typeof this.masterBypassDryGain.gain.setTargetAtTime !== 'function') {
      this.masterBypassDryGain.gain.value = dry;
      this.masterBypassWetGain.gain.value = wet;
    } else {
      this.masterBypassDryGain.gain.setTargetAtTime(dry, now, 0.015);
      this.masterBypassWetGain.gain.setTargetAtTime(wet, now, 0.015);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Adjusts master return gain in dB with anti-click ramping.
   */
  public setReturnGainDb(gainDb: number, immediate = false): void {
    this.returnGainDb = gainDb;
    const isMuted = !Number.isFinite(gainDb) || gainDb <= -48;
    const lin = isMuted ? 0.0 : Math.pow(10, gainDb / 20);
    const now = this.ctx.currentTime;

    if (immediate || typeof this.returnGainNode.gain.setTargetAtTime !== 'function') {
      this.returnGainNode.gain.value = lin;
    } else {
      this.returnGainNode.gain.setTargetAtTime(lin, now, 0.015);
    }
  }

  public getReturnGainDb(): number {
    return this.returnGainDb;
  }

  /**
   * Exports declarative configuration snapshot for persistence.
   */
  public toConfig(): AuxBusConfig {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      enabled: this.enabled,
      returnGainDb: this.returnGainDb,
      modules: this.modules.map((m) => m.getConfig()),
    };
  }

  public getConfig(): AuxBusConfig {
    return this.toConfig();
  }

  public disconnect(): void {
    try {
      this.outputNode.disconnect();
    } catch {}
  }

  private disposeModules(): void {
    try {
      this.inputNode.disconnect(this.returnGainNode);
    } catch {}
    for (const mod of this.modules) {
      mod.dispose();
    }
    this.modules = [];
  }

  public dispose(): void {
    this.disposeModules();
    try {
      this.inputNode.disconnect();
      this.masterBypassDryGain.disconnect();
      this.masterBypassWetGain.disconnect();
      this.returnGainNode.disconnect();
      this.outputNode.disconnect();
    } catch {}
  }
}
