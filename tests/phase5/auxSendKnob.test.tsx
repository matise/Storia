import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuxSendKnob } from '../../src/components/workbench/AuxSendKnob';
import { WaveformCanvas } from '../../src/components/workbench/WaveformCanvas';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('Phase 3 & 4 — Aux Send Knob & Modular DSP Routing UI Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    useStoriaStore.getState().importProjectFromBundle(createSampleProject());
  });

  it('renders AuxSendKnob at 0.0 dB unity send and responds to drag and double click', () => {
    const handleChange = vi.fn();
    render(
      <AuxSendKnob
        valueDb={0}
        onChange={handleChange}
        size={26}
        testId="test-aux-knob"
        busName="Main FX"
      />
    );

    const knob = screen.getByTestId('test-aux-knob');
    expect(knob).toBeDefined();
    expect(knob.textContent).toContain('0.0');
    expect(knob.textContent).toContain('dB');
    expect(knob.title).toContain('Main FX');

    // Simulate vertical drag up (increase send level)
    fireEvent.pointerDown(knob, { clientY: 100 });
    fireEvent.pointerMove(knob, { clientY: 70 });
    expect(handleChange).toHaveBeenCalled();

    // Simulate double click to reset to 0.0 dB unity send
    fireEvent.doubleClick(knob);
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it('renders formatted -∞ when send level is muted (<= -48 dB)', () => {
    render(
      <AuxSendKnob
        valueDb={-60}
        onChange={vi.fn()}
        testId="test-aux-knob-muted"
      />
    );

    const knob = screen.getByTestId('test-aux-knob-muted');
    expect(knob.textContent).toContain('-∞');
  });

  it('renders emerald AuxSendKnob alongside VolumeGainKnob in WaveformCanvas when audio is rendered', () => {
    const handleChangeGain = vi.fn();
    const handleChangeSend = vi.fn();
    const mockPeaks = {
      sampleRate: 100,
      length: 10,
      minPeaks: new Float32Array(10).fill(-0.5),
      maxPeaks: new Float32Array(10).fill(0.5),
      rmsLevels: new Float32Array(10).fill(0.3),
    };

    render(
      <WaveformCanvas
        peaks={mockPeaks}
        playheadProgress={0.2}
        accentColor="#10b981"
        isRenderedAudio={true}
        blockId="blk_test_aux"
        showTransportControls={true}
        volumeGainDb={-2.5}
        onChangeGainDb={handleChangeGain}
        auxSendDb={0.0}
        onChangeAuxSendDb={handleChangeSend}
      />
    );

    // Both knobs should be rendered side-by-side
    const gainKnob = screen.getByTestId('gain-knob-blk_test_aux');
    const auxKnob = screen.getByTestId('aux-send-knob-blk_test_aux');
    expect(gainKnob).toBeDefined();
    expect(auxKnob).toBeDefined();

    expect(gainKnob.textContent).toContain('-2.5');
    expect(auxKnob.textContent).toContain('0.0');

    // Drag aux send knob
    fireEvent.pointerDown(auxKnob, { clientY: 100 });
    fireEvent.pointerMove(auxKnob, { clientY: 80 });
    expect(handleChangeSend).toHaveBeenCalled();
  });

  it('synchronizes toolbar EQ:ON and Dyn:ON toggles with project aux bus modules in useStoriaStore', () => {
    const store = useStoriaStore.getState();
    const speaker = store.project.speakers[0];
    expect(speaker).toBeDefined();

    // Verify default main aux bus exists
    const initialBusses = store.project.auxBusses;
    expect(initialBusses).toBeDefined();
    expect(initialBusses?.length).toBeGreaterThan(0);
    const mainBus = initialBusses?.find((b) => b.id === 'aux_bus_main');
    expect(mainBus).toBeDefined();

    const eqModule = mainBus?.modules.find((m) => m.id === 'fx_main_eq');
    const dynModule = mainBus?.modules.find((m) => m.id === 'fx_main_dyn');
    expect(eqModule?.enabled).toBe(true);
    expect(dynModule?.enabled).toBe(true);

    // Toggle EQ
    store.toggleSpeakerEq(speaker.id);
    const updatedBusAfterEq = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main');
    const updatedEq = updatedBusAfterEq?.modules.find((m) => m.id === 'fx_main_eq');
    expect(updatedEq?.enabled).toBe(false);

    // Toggle Dynamics
    store.toggleSpeakerDynamics(speaker.id);
    const updatedBusAfterDyn = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main');
    const updatedDyn = updatedBusAfterDyn?.modules.find((m) => m.id === 'fx_main_dyn');
    expect(updatedDyn?.enabled).toBe(false);

    // Toggle Aux bus module directly
    store.toggleAuxBusModule('aux_bus_main', 'fx_main_eq');
    const reEnabledEq = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main')?.modules.find((m) => m.id === 'fx_main_eq');
    expect(reEnabledEq?.enabled).toBe(true);

    // Adjust return gain on aux bus
    store.setAuxBusReturnGainDb('aux_bus_main', -4.5);
    const busWithNewReturn = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main');
    expect(busWithNewReturn?.returnGainDb).toBe(-4.5);
  });
});

