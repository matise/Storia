import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useStoriaStore } from '../../src/store/useStoriaStore';

describe('Phase 6 — Step 6.4: ExportMasterModal Studio Integration', () => {
  it('opens ExportMasterModal from TopBar, switches tabs, and adjusts mastering parameters', () => {
    useStoriaStore.getState().resetToSampleProject();
    render(<App />);

    // 1. Click [Export Master] in TopBar
    const exportBtn = screen.getByTestId('topbar-export-master-btn');
    fireEvent.click(exportBtn);

    // Modal should now be visible
    const modal = screen.getByTestId('export-master-modal');
    expect(modal).toBeDefined();

    // 2. Sample rate selector and bit depth selector
    const sampleRateSelect = screen.getByTestId('export-sample-rate-select') as HTMLSelectElement;
    expect(sampleRateSelect.value).toBe('48000');

    fireEvent.change(sampleRateSelect, { target: { value: '44100' } });
    expect(useStoriaStore.getState().project.audioConfig.sampleRate).toBe(44100);

    const bitDepthSelect = screen.getByTestId('export-bit-depth-select') as HTMLSelectElement;
    expect(bitDepthSelect.value).toBe('24');

    fireEvent.change(bitDepthSelect, { target: { value: '16' } });
    expect(useStoriaStore.getState().project.audioConfig.bitDepth).toBe(16);

    // 3. Switch to Script & Project Archive tab
    const scriptTab = screen.getByTestId('export-tab-script');
    fireEvent.click(scriptTab);

    expect(screen.getByTestId('export-fountain-btn')).toBeDefined();
    expect(screen.getByTestId('export-markdown-btn')).toBeDefined();
    expect(screen.getByTestId('export-project-json-btn')).toBeDefined();
    expect(screen.getByTestId('import-project-json-btn')).toBeDefined();

    // 4. Close modal
    const closeBtn = screen.getByTestId('close-export-modal-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('export-master-modal')).toBeNull();
  });
});

