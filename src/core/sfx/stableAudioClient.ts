/**
 * Client interface for the local Stable Audio 3 background daemon and Vite Service Bridge.
 * Connects via Vite reverse proxy (/api/stable-audio) or direct daemon host (http://127.0.0.1:8000).
 */

export interface StableAudioStatus {
  device: string;
  device_name: string;
  active_model: string | null;
  is_hibernating: boolean;
  idle_seconds: number;
  half_precision: boolean;
  vram_allocated_mb: number;
  vram_reserved_mb: number;
  peak_vram_mb: number;
}

export interface ModelStatusInfo {
  model_name: string;
  repo_id: string;
  description: string;
  is_installed: boolean;
  installed_size_mb: number;
  missing_files: string[];
}

export interface DownloadProgressInfo {
  is_downloading: boolean;
  active_model: string | null;
  file: string | null;
  progress_pct: number;
  speed_mb_s: number;
  downloaded_mb: number;
  total_mb: number;
  error: string | null;
}

export interface GenerateAudioRequest {
  prompt: string;
  negative_prompt?: string;
  duration_seconds: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  chunked_decode?: boolean;
}

export interface GenerateAudioResponse {
  audioBlob: Blob;
  audioUrl: string;
  audioBuffer?: AudioBuffer;
  generationTimeSec: number;
  sampleRate: number;
  vramAllocatedMb: number;
}

export interface ServiceBridgeStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  isPortActive: boolean;
  pid: number | null;
  uptimeSec: number;
  lastExitCode: number | null;
  pythonExe: string;
}

export class StableAudioClient {
  private primaryUrl: string;
  private fallbackUrl: string;
  private resolvedUrl: string | null = null;

  constructor(primaryUrl: string = '/api/stable-audio', fallbackUrl: string = 'http://127.0.0.1:8000') {
    this.primaryUrl = primaryUrl.replace(/\/+$/, '');
    this.fallbackUrl = fallbackUrl.replace(/\/+$/, '');
  }

  private async getWorkingBaseUrl(): Promise<string> {
    if (this.resolvedUrl) return this.resolvedUrl;

    // Probe primary proxy URL first with a fast timeout
    try {
      const res = await fetch(`${this.primaryUrl}/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) {
        this.resolvedUrl = this.primaryUrl;
        return this.primaryUrl;
      }
    } catch {
      // ignore
    }

    // Probe direct fallback URL
    try {
      const res = await fetch(`${this.fallbackUrl}/health`, { credentials: 'omit', signal: AbortSignal.timeout(800) });
      if (res.ok) {
        this.resolvedUrl = this.fallbackUrl;
        return this.fallbackUrl;
      }
    } catch {
      // ignore
    }

    throw new Error('Stable Audio daemon offline');
  }

  /**
   * Reset resolved URL cache (e.g. after restarting the daemon).
   */
  resetConnectionCache(): void {
    this.resolvedUrl = null;
  }

  /**
   * Query the health and VRAM status of the Stable Audio daemon.
   */
  async getStatus(): Promise<StableAudioStatus> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/status`, { signal: AbortSignal.timeout(1200) });
    if (!res.ok) {
      this.resetConnectionCache();
      throw new Error(`Failed to fetch status from Stable Audio daemon: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * List all models supported by the daemon and their local installation state.
   */
  async getModels(): Promise<ModelStatusInfo[]> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/models`, { signal: AbortSignal.timeout(1200) });
    if (!res.ok) {
      throw new Error(`Failed to query model list: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Query active model download progress.
   */
  async getDownloadProgress(): Promise<DownloadProgressInfo> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/models/progress`);
    if (!res.ok) {
      throw new Error(`Failed to query download progress: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Trigger background download of a model ('small-sfx', 'small-music', 'small-music-base', or 'all').
   */
  async downloadModel(modelName: string): Promise<{ status: string; model_name: string; message: string }> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/models/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model_name: modelName }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to trigger model download (${res.status}): ${errText}`);
    }
    return res.json();
  }

  /**
   * Generate sound effects using the 'small-sfx' model.
   */
  async generateSfx(
    req: GenerateAudioRequest,
    audioContext?: AudioContext
  ): Promise<GenerateAudioResponse> {
    const base = await this.getWorkingBaseUrl();
    return this.postGenerate(`${base}/v1/sfx/generate`, req, audioContext);
  }

  /**
   * Generate melodic score beds or themes using the 'small-music' model.
   */
  async generateMusic(
    req: GenerateAudioRequest,
    modelVariant: 'small-music' | 'small-music-base' = 'small-music',
    audioContext?: AudioContext
  ): Promise<GenerateAudioResponse> {
    const base = await this.getWorkingBaseUrl();
    const url = `${base}/v1/music/generate?model_variant=${modelVariant}`;
    return this.postGenerate(url, req, audioContext);
  }

  /**
   * Put the model to sleep, releasing 100% of GPU VRAM to system host RAM.
   */
  async hibernate(): Promise<void> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/hibernate`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Hibernation request failed: ${res.statusText}`);
    }
  }

  /**
   * Pre-warm and restore the model from host RAM back to GPU VRAM.
   */
  async wake(): Promise<void> {
    const base = await this.getWorkingBaseUrl();
    const res = await fetch(`${base}/v1/system/wake`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Wake request failed: ${res.statusText}`);
    }
  }

  // --------------------------------------------------------------------------
  // Vite Node.js Service Bridge (Process Lifecycle Management)
  // --------------------------------------------------------------------------

  async getBridgeStatus(): Promise<ServiceBridgeStatus> {
    const res = await fetch('/api/service-bridge/status');
    if (!res.ok) {
      throw new Error(`Service bridge unavailable (${res.status}): ${res.statusText}`);
    }
    return res.json();
  }

  async startService(): Promise<{ success: boolean; message: string }> {
    this.resetConnectionCache();
    const res = await fetch('/api/service-bridge/start', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to start service: ${res.statusText}`);
    }
    return res.json();
  }

  async stopService(): Promise<{ success: boolean; message: string }> {
    this.resetConnectionCache();
    const res = await fetch('/api/service-bridge/stop', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to stop service: ${res.statusText}`);
    }
    return res.json();
  }

  async restartService(): Promise<{ success: boolean; message: string }> {
    this.resetConnectionCache();
    const res = await fetch('/api/service-bridge/restart', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to restart service: ${res.statusText}`);
    }
    return res.json();
  }

  async getBridgeLogs(): Promise<{ logs: string[] }> {
    const res = await fetch('/api/service-bridge/logs');
    if (!res.ok) {
      throw new Error(`Failed to retrieve logs: ${res.statusText}`);
    }
    return res.json();
  }

  async clearBridgeLogs(): Promise<{ success: boolean }> {
    const res = await fetch('/api/service-bridge/clear-logs', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to clear logs: ${res.statusText}`);
    }
    return res.json();
  }

  private async postGenerate(
    endpoint: string,
    req: GenerateAudioRequest,
    audioContext?: AudioContext
  ): Promise<GenerateAudioResponse> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Generation failed (${res.status}): ${errText}`);
    }

    const genTime = parseFloat(res.headers.get('X-Generation-Time') || '0');
    const sampleRate = parseInt(res.headers.get('X-Sample-Rate') || '44100', 10);
    const vramMb = parseFloat(res.headers.get('X-VRAM-Allocated-MB') || '0');

    const arrayBuffer = await res.arrayBuffer();
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);

    let audioBuffer: AudioBuffer | undefined;
    if (audioContext) {
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (e) {
        console.warn('Could not decode audio data in browser audio context:', e);
      }
    }

    return {
      audioBlob,
      audioUrl,
      audioBuffer,
      generationTimeSec: genTime,
      sampleRate,
      vramAllocatedMb: vramMb,
    };
  }
}

export const stableAudioClient = new StableAudioClient();
