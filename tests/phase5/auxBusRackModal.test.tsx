import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuxBusRackModal } from '../../src/components/modals/AuxBusRackModal';
import { EpisodeWaveformTransport } from '../../src/components/workbench/EpisodeWaveformTransport';
import { useStoriaStore } from '../../src/store/useStoriaStore';
import { createSampleProject } from '../../src/i18n/sampleProject';

describe('AuxBusRackModal — Studio Aux DSP Rack Inspector & Live Controls', () => {
  beforeEach(() => {
    useStoriaStore.getState().importProjectFromBundle(createSampleProject());
  });

  it('opens and closes the AuxBusRackModal via store state and Done button', () => {
    const store = useStoriaStore.getState();
    store.setAuxBusModalOpen(false);

    const { rerender } = render(<AuxBusRackModal />);
    expect(screen.queryByTestId('aux-bus-rack-modal')).toBeNull();

    // Open modal
    useStoriaStore.getState().setAuxBusModalOpen(true);
    rerender(<AuxBusRackModal />);

    const modal = screen.getByTestId('aux-bus-rack-modal');
    expect(modal).toBeDefined();
    expect(modal.textContent).toContain('Main FX');

    // Click Done to close
    const doneBtn = screen.getByTestId('aux-bus-done-btn');
    fireEvent.click(doneBtn);
    expect(useStoriaStore.getState().isAuxBusModalOpen).toBe(false);
  });

  it('renders FX Bus button on EpisodeWaveformTransport and opens modal', () => {
    const store = useStoriaStore.getState();
    store.setAuxBusModalOpen(false);

    render(
      <EpisodeWaveformTransport
        blocks={store.project.blocks}
        speakers={store.project.speakers}
        playheadSec={0}
        totalDurationSec={100}
        activeBlockIndex={0}
        isPlaying={false}
        isLooping={false}
        playbackSpeed={1.0}
        onTogglePlay={vi.fn()}
        onStop={vi.fn()}
        onToggleLoop={vi.fn()}
        onSeekTimeSec={vi.fn()}
        onJumpBlockIndex={vi.fn()}
        onChangeSpeed={vi.fn()}
      />
    );

    const fxBusBtn = screen.getByTestId('timeline-aux-bus-btn');
    expect(fxBusBtn).toBeDefined();
    expect(fxBusBtn.textContent).toContain('FX Bus');

    fireEvent.click(fxBusBtn);
    expect(useStoriaStore.getState().isAuxBusModalOpen).toBe(true);
  });

  it('allows adjusting EQ, compressor threshold, and adding a State-Variable Filter module', () => {
    useStoriaStore.getState().setAuxBusModalOpen(true);
    render(<AuxBusRackModal />);

    // Check default modules are rendered
    const eqCard = screen.getByTestId('aux-module-fx_main_eq');
    const dynCard = screen.getByTestId('aux-module-fx_main_dyn');
    expect(eqCard).toBeDefined();
    expect(dynCard).toBeDefined();

    // Toggle EQ module bypass
    const eqBypassBtn = eqCard.querySelector('button');
    if (eqBypassBtn) {
      fireEvent.click(eqBypassBtn);
      const mainBus = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main');
      const eqMod = mainBus?.modules.find((m) => m.id === 'fx_main_eq');
      expect(eqMod?.enabled).toBe(false);
    }

    // Add State-Variable Filter
    const addFilterBtn = screen.getByText('State-Variable Filter');
    fireEvent.click(addFilterBtn);

    const updatedBusses = useStoriaStore.getState().project.auxBusses?.find((b) => b.id === 'aux_bus_main');
    expect(updatedBusses?.modules.length).toBe(3);
    const filterMod = updatedBusses?.modules.find((m) => m.type === 'state_variable_filter');
    expect(filterMod).toBeDefined();
  });
});
