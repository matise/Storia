import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { ScriptBlockCard } from '../../src/components/workbench/ScriptBlockCard';
import { BackgroundServicesModal } from '../../src/components/modals/BackgroundServicesModal';
import { TopBar } from '../../src/components/layout/TopBar';
import { stableAudioClient } from '../../src/core/sfx/stableAudioClient';

describe('Stable Audio 3 & Background Services Frontend Integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useStoriaStore.setState({
      isStableAudioDaemonOnline: false,
      isBackgroundServicesModalOpen: false,
      stableAudioStatus: null,
      stableAudioBridgeStatus: null,
    });
  });

  beforeEach(async () => {
    useStoriaStore.getState().resetToSampleProject();
    useStoriaStore.setState({
      isBackgroundServicesModalOpen: false,
      isStableAudioDaemonOnline: false,
      stableAudioStatus: null,
      stableAudioBridgeStatus: null,
      stableAudioModels: [
        {
          model_name: 'small-sfx',
          repo_id: 'stabilityai/stable-audio-3-small-sfx',
          description: 'Sound effects and foley',
          is_installed: true,
          installed_size_mb: 2150,
          missing_files: [],
        },
        {
          model_name: 'small-music',
          repo_id: 'stabilityai/stable-audio-3-small-music',
          description: 'Melodic scores and instruments',
          is_installed: false,
          installed_size_mb: 0,
          missing_files: ['model.safetensors'],
        },
      ],
    });
  });

  it('updates store state when querying background services and toggling modal', async () => {
    const store = useStoriaStore.getState();
    expect(store.isBackgroundServicesModalOpen).toBe(false);

    store.setBackgroundServicesModalOpen(true);
    expect(useStoriaStore.getState().isBackgroundServicesModalOpen).toBe(true);

    store.setBackgroundServicesModalOpen(false);
    expect(useStoriaStore.getState().isBackgroundServicesModalOpen).toBe(false);
  });

  it('renders the TopBar background services telemetry pill and opens modal on click', () => {
    useStoriaStore.setState({
      isStableAudioDaemonOnline: true,
      stableAudioStatus: {
        device: 'cuda',
        device_name: 'Quadro RTX 5000',
        active_model: 'small-sfx',
        is_hibernating: false,
        idle_seconds: 12,
        half_precision: true,
        vram_allocated_mb: 2450.5,
        vram_reserved_mb: 3000,
        peak_vram_mb: 3100,
      },
    });

    render(<TopBar />);
    const pill = screen.getByTestId('topbar-bg-services-btn');
    expect(pill).toBeDefined();
    expect(pill.textContent).toContain('GPU: 2450.5 MB');

    fireEvent.click(pill);
    expect(useStoriaStore.getState().isBackgroundServicesModalOpen).toBe(true);
  });

  it('renders SFX Engine selector in ScriptBlockCard and enables Stable Audio 3 controls', () => {
    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;
    expect(sfxBlock).toBeDefined();

    render(<ScriptBlockCard block={sfxBlock} index={0} totalBlocks={1} isSelected={true} />);

    // Check that SFX Engine select is present
    const engineSelect = screen.getByTestId(`sfx-engine-select-${sfxBlock.id}`) as HTMLSelectElement;
    expect(engineSelect).toBeDefined();

    // Switch engine to 'stable_audio'
    fireEvent.change(engineSelect, { target: { value: 'stable_audio' } });

    const updatedBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    expect(updatedBlock.sfxEngine).toBe('stable_audio');
  });

  it('handles UI configuration for model variant, diffusion steps, and seed on sound effect blocks', () => {
    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;

    // Set engine to stable_audio first
    store.updateBlock(sfxBlock.id, { sfxEngine: 'stable_audio' });

    const currentBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    render(<ScriptBlockCard block={currentBlock} index={0} totalBlocks={1} isSelected={true} />);

    // Check variant selector
    const variantSelect = screen.getByLabelText('Stable Audio Model Variant') as HTMLSelectElement;
    expect(variantSelect).toBeDefined();
    fireEvent.change(variantSelect, { target: { value: 'small-music' } });
    expect(useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!.sfxModelVariant).toBe('small-music');

    // Check steps input
    const stepsInput = screen.getByDisplayValue('8') as HTMLInputElement;
    expect(stepsInput).toBeDefined();
    fireEvent.change(stepsInput, { target: { value: '14' } });
    expect(useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!.sfxSteps).toBe(14);

    // Click randomize seed button
    const diceBtn = screen.getByTitle(/Click to randomize/i);
    expect(diceBtn).toBeDefined();
    fireEvent.click(diceBtn);
    const randomizedSeed = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!.sfxSeed;
    expect(randomizedSeed).toBeDefined();
    expect(randomizedSeed).toBeGreaterThanOrEqual(0);
  });

  it('synthesizes SFX via stableAudioClient when user clicks Generate SFX button', async () => {
    useStoriaStore.setState({
      isStableAudioDaemonOnline: true,
      stableAudioModels: [
        {
          model_name: 'small-sfx',
          repo_id: 'stabilityai/stable-audio-3-small-sfx',
          description: 'Sound effects and foley',
          is_installed: true,
          installed_size_mb: 2150,
          missing_files: [],
        },
      ],
    });

    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;
    store.updateBlock(sfxBlock.id, {
      sfxEngine: 'stable_audio',
      sfxModelVariant: 'small-sfx',
      sfxDurationSec: 2.0,
      sfxSteps: 8,
      sfxSeed: 42,
      ttsStatus: 'stale',
      generatedAudioUrl: undefined,
    });

    // Mock stableAudioClient.generateSfx
    const mockPcm = new Uint8Array(44 + 44100 * 2 * 2); // 2s stereo 16-bit
    const mockBlob = new Blob([mockPcm], { type: 'audio/wav' });
    const generateSfxSpy = vi.spyOn(stableAudioClient, 'generateSfx').mockResolvedValueOnce({
      audioBlob: mockBlob,
      audioUrl: 'blob:mock-stable-audio-url',
      generationTimeSec: 0.95,
      sampleRate: 44100,
      vramAllocatedMb: 2179.3,
    });

    const currentBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    render(<ScriptBlockCard block={currentBlock} index={0} totalBlocks={1} isSelected={true} />);

    const generateBtn = screen.getByTestId(`generate-block-btn-${sfxBlock.id}`);
    expect(generateBtn).toBeDefined();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const updated = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
      expect(updated.ttsStatus).toBe('ok');
    });

    expect(generateSfxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 2.0,
        steps: 8,
        seed: 42,
      }),
      undefined
    );

    const finalizedBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    expect(finalizedBlock.ttsStatus).toBe('ok');
    expect(finalizedBlock.generatedAudioUrl).toBeDefined();
    expect(finalizedBlock.waveformPeaks).toBeDefined();
    expect(finalizedBlock.waveformPeaks!.maxPeaks.length).toBeGreaterThan(0);
  });

  it('falls back to procedural synthesis when Stable Audio daemon call fails', async () => {
    useStoriaStore.setState({
      isStableAudioDaemonOnline: true,
      stableAudioModels: [
        {
          model_name: 'small-sfx',
          repo_id: 'stabilityai/stable-audio-3-small-sfx',
          description: 'Sound effects and foley',
          is_installed: true,
          installed_size_mb: 2150,
          missing_files: [],
        },
      ],
    });

    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;
    store.updateBlock(sfxBlock.id, {
      sfxEngine: 'stable_audio',
      sfxModelVariant: 'small-sfx',
      sfxDurationSec: 2.0,
      ttsStatus: 'stale',
      generatedAudioUrl: undefined,
    });

    // Mock stableAudioClient.generateSfx failure
    vi.spyOn(stableAudioClient, 'generateSfx').mockRejectedValueOnce(
      new Error('ECONNREFUSED: Daemon is offline')
    );

    const currentBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    render(<ScriptBlockCard block={currentBlock} index={0} totalBlocks={1} isSelected={true} />);

    const generateBtn = screen.getByTestId(`generate-block-btn-${sfxBlock.id}`);
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const updated = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
      expect(updated.ttsStatus).toBe('ok');
      expect(updated.generatedAudioUrl).toBeDefined();
    });
  });

  it('renders BackgroundServicesModal with status, models, and process control actions', async () => {
    vi.spyOn(stableAudioClient, 'getStatus').mockResolvedValue({
      device: 'cuda',
      device_name: 'Quadro RTX 5000',
      active_model: 'small-sfx',
      is_hibernating: false,
      idle_seconds: 0,
      half_precision: true,
      vram_allocated_mb: 2450.5,
      vram_reserved_mb: 3000,
      peak_vram_mb: 3100,
    });
    vi.spyOn(stableAudioClient, 'getBridgeStatus').mockResolvedValue({
      status: 'running',
      isPortActive: true,
      pid: 12345,
      uptimeSec: 120,
      lastExitCode: null,
      pythonExe: 'python.exe',
    });
    vi.spyOn(stableAudioClient, 'getBridgeLogs').mockResolvedValue({ logs: [] });

    useStoriaStore.setState({
      isBackgroundServicesModalOpen: true,
      isStableAudioDaemonOnline: true,
      stableAudioStatus: {
        device: 'cuda',
        device_name: 'Quadro RTX 5000',
        active_model: 'small-sfx',
        is_hibernating: false,
        idle_seconds: 0,
        half_precision: true,
        vram_allocated_mb: 2450.5,
        vram_reserved_mb: 3000,
        peak_vram_mb: 3100,
      },
      stableAudioBridgeStatus: {
        status: 'running',
        isPortActive: true,
        pid: 12345,
        uptimeSec: 120,
        lastExitCode: null,
        pythonExe: 'python.exe',
      },
    });

    render(<BackgroundServicesModal />);
    const modal = screen.getByTestId('background-services-modal');
    expect(modal).toBeDefined();
    expect(screen.getByText(/Quadro RTX 5000/i)).toBeDefined();
    expect(screen.getByText(/VRAM: 2450.5 MB/i)).toBeDefined();
    expect(screen.getByText('small-sfx')).toBeDefined();
    expect(screen.getByText('READY')).toBeDefined();
    expect(screen.getByText('small-music')).toBeDefined();
    expect(screen.getByText('MISSING')).toBeDefined();
  });

  it('triggers daemon stop action from BackgroundServicesModal', async () => {
    vi.spyOn(stableAudioClient, 'getStatus').mockResolvedValue({
      device: 'cuda',
      device_name: 'Quadro RTX 5000',
      active_model: 'small-sfx',
      is_hibernating: false,
      idle_seconds: 5,
      half_precision: true,
      vram_allocated_mb: 2179.3,
      vram_reserved_mb: 2994.0,
      peak_vram_mb: 2228.5,
    });
    vi.spyOn(stableAudioClient, 'getBridgeStatus').mockResolvedValue({
      status: 'running',
      isPortActive: true,
      pid: 36160,
      uptimeSec: 300,
      lastExitCode: null,
      pythonExe: 'python.exe',
    });
    vi.spyOn(stableAudioClient, 'getBridgeLogs').mockResolvedValue({ logs: [] });
    const stopSpy = vi.spyOn(stableAudioClient, 'stopService').mockResolvedValueOnce({
      success: true,
      message: 'Daemon stopped successfully',
    });

    useStoriaStore.setState({
      isBackgroundServicesModalOpen: true,
      isStableAudioDaemonOnline: true,
      isStartingOrStoppingDaemon: false,
      stableAudioStatus: {
        device: 'cuda',
        device_name: 'Quadro RTX 5000',
        active_model: 'small-sfx',
        is_hibernating: false,
        idle_seconds: 5,
        half_precision: true,
        vram_allocated_mb: 2179.3,
        vram_reserved_mb: 2994.0,
        peak_vram_mb: 2228.5,
      },
      stableAudioBridgeStatus: {
        status: 'running',
        isPortActive: true,
        pid: 36160,
        uptimeSec: 300,
        lastExitCode: null,
        pythonExe: 'python.exe',
      },
    });

    render(<BackgroundServicesModal />);
    const stopBtn = screen.getByTestId('bg-services-stop-btn');
    expect(stopBtn).toBeDefined();
    fireEvent.click(stopBtn);
    await waitFor(() => expect(stopSpy).toHaveBeenCalledTimes(1));
  });

  it('triggers daemon restart and hibernate actions from BackgroundServicesModal', async () => {
    vi.spyOn(stableAudioClient, 'getStatus').mockResolvedValue({
      device: 'cuda',
      device_name: 'Quadro RTX 5000',
      active_model: 'small-sfx',
      is_hibernating: false,
      idle_seconds: 5,
      half_precision: true,
      vram_allocated_mb: 2179.3,
      vram_reserved_mb: 2994.0,
      peak_vram_mb: 2228.5,
    });
    vi.spyOn(stableAudioClient, 'getBridgeStatus').mockResolvedValue({
      status: 'running',
      isPortActive: true,
      pid: 36160,
      uptimeSec: 300,
      lastExitCode: null,
      pythonExe: 'python.exe',
    });
    vi.spyOn(stableAudioClient, 'getBridgeLogs').mockResolvedValue({ logs: [] });
    const restartSpy = vi.spyOn(stableAudioClient, 'restartService').mockResolvedValueOnce({
      success: true,
      message: 'Daemon restarted successfully',
    });
    const hibernateSpy = vi.spyOn(stableAudioClient, 'hibernate').mockResolvedValueOnce(undefined);

    useStoriaStore.setState({
      isBackgroundServicesModalOpen: true,
      isStableAudioDaemonOnline: true,
      isStartingOrStoppingDaemon: false,
      stableAudioStatus: {
        device: 'cuda',
        device_name: 'Quadro RTX 5000',
        active_model: 'small-sfx',
        is_hibernating: false,
        idle_seconds: 5,
        half_precision: true,
        vram_allocated_mb: 2179.3,
        vram_reserved_mb: 2994.0,
        peak_vram_mb: 2228.5,
      },
      stableAudioBridgeStatus: {
        status: 'running',
        isPortActive: true,
        pid: 36160,
        uptimeSec: 300,
        lastExitCode: null,
        pythonExe: 'python.exe',
      },
    });

    render(<BackgroundServicesModal />);

    // Click Hibernate
    const hibernateBtn = screen.getByTestId('bg-services-hibernate-btn');
    fireEvent.click(hibernateBtn);
    await waitFor(() => expect(hibernateSpy).toHaveBeenCalledTimes(1));

    // Click Restart
    const restartBtn = screen.getByTestId('bg-services-restart-btn');
    fireEvent.click(restartBtn);
    await waitFor(() => expect(restartSpy).toHaveBeenCalledTimes(1));
  });

  it('renders wake button when daemon is hibernating and dispatches wake action', async () => {
    vi.spyOn(stableAudioClient, 'getStatus').mockResolvedValue({
      device: 'cuda',
      device_name: 'Quadro RTX 5000',
      active_model: 'small-sfx',
      is_hibernating: true,
      idle_seconds: 350,
      half_precision: true,
      vram_allocated_mb: 0,
      vram_reserved_mb: 0,
      peak_vram_mb: 2228.5,
    });
    vi.spyOn(stableAudioClient, 'getBridgeStatus').mockResolvedValue({
      status: 'running',
      isPortActive: true,
      pid: 36160,
      uptimeSec: 300,
      lastExitCode: null,
      pythonExe: 'python.exe',
    });
    vi.spyOn(stableAudioClient, 'getBridgeLogs').mockResolvedValue({ logs: [] });
    const wakeSpy = vi.spyOn(stableAudioClient, 'wake').mockResolvedValueOnce(undefined);

    useStoriaStore.setState({
      isBackgroundServicesModalOpen: true,
      isStableAudioDaemonOnline: true,
      stableAudioStatus: {
        device: 'cuda',
        device_name: 'Quadro RTX 5000',
        active_model: 'small-sfx',
        is_hibernating: true,
        idle_seconds: 350,
        half_precision: true,
        vram_allocated_mb: 0,
        vram_reserved_mb: 0,
        peak_vram_mb: 2228.5,
      },
    });

    render(<BackgroundServicesModal />);
    const wakeBtn = screen.getByTestId('bg-services-wake-btn');
    expect(wakeBtn).toBeDefined();
    fireEvent.click(wakeBtn);
    await waitFor(() => expect(wakeSpy).toHaveBeenCalledTimes(1));
  });

  it('allows user to customize SFX duration input and passes duration to synthesis engine', async () => {
    useStoriaStore.setState({
      isStableAudioDaemonOnline: true,
      stableAudioModels: [
        {
          model_name: 'small-sfx',
          repo_id: 'stabilityai/stable-audio-3-small-sfx',
          description: 'Sound effects and foley',
          is_installed: true,
          installed_size_mb: 2150,
          missing_files: [],
        },
      ],
    });

    const store = useStoriaStore.getState();
    const sfxBlock = store.project.blocks.find((b) => b.type === 'sound_effect')!;
    store.updateBlock(sfxBlock.id, {
      sfxEngine: 'stable_audio',
      sfxModelVariant: 'small-sfx',
      sfxDurationSec: 3.5,
      ttsStatus: 'stale',
    });

    const generateSpy = vi.spyOn(stableAudioClient, 'generateSfx').mockResolvedValueOnce({
      audioBlob: new Blob([new Uint8Array(44 + 44100 * 2)], { type: 'audio/wav' }),
      audioUrl: 'blob:mock-custom-duration-url',
      generationTimeSec: 1.1,
      sampleRate: 44100,
      vramAllocatedMb: 2179.3,
    });

    const currentBlock = useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!;
    render(<ScriptBlockCard block={currentBlock} index={0} totalBlocks={1} isSelected={true} />);

    // Change duration from 3.5 to 5.0
    const durationInput = screen.getByTestId(`sfx-duration-input-${sfxBlock.id}`) as HTMLInputElement;
    expect(durationInput).toBeDefined();
    fireEvent.change(durationInput, { target: { value: '5.0' } });

    expect(useStoriaStore.getState().project.blocks.find((b) => b.id === sfxBlock.id)!.sfxDurationSec).toBe(5.0);

    // Click Generate
    const generateBtn = screen.getByTestId(`generate-block-btn-${sfxBlock.id}`);
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_seconds: 5.0,
        }),
        undefined
      );
    });
  });
});
