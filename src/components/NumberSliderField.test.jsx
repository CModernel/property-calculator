// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumberSliderField from './NumberSliderField';

describe('NumberSliderField', () => {
  it('commits a valid typed value on blur, clamped to [min, max]', () => {
    const onChange = vi.fn();
    render(<NumberSliderField label="Test" value={50} onChange={onChange} min={0} max={100} />);
    const input = screen.getByLabelText('Test');

    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(75);

    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('keeps the previous value on blur with empty/garbage draft text - no onChange call', () => {
    const onChange = vi.fn();
    render(<NumberSliderField label="Test" value={50} onChange={onChange} min={0} max={100} />);
    const input = screen.getByLabelText('Test');

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('50');
  });

  it('Enter commits the draft, Escape discards it back to the current value', () => {
    const onChange = vi.fn();
    render(<NumberSliderField label="Test" value={50} onChange={onChange} min={0} max={100} />);
    const input = screen.getByLabelText('Test');

    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(60);

    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledTimes(1); // still just the Enter commit
    expect(input.value).toBe('50');
  });

  it('ArrowUp/ArrowDown on the number input commits immediately on keyup, not waiting for blur', () => {
    const onChange = vi.fn();
    render(<NumberSliderField label="Test" value={50} onChange={onChange} min={0} max={100} />);
    const input = screen.getByLabelText('Test');

    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.keyUp(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(70);
  });

  it('neutralizes an inverted sliderMin > sliderMax via safeSliderMax', () => {
    render(
      <NumberSliderField label="Test" value={50} onChange={() => {}} min={0} max={200} sliderMin={100} sliderMax={50} />
    );
    const slider = screen.getByLabelText('Test slider');
    expect(slider).toHaveAttribute('max', '100');
  });

  it('shows the amber below-range indicator when the value is under sliderMin', () => {
    render(
      <NumberSliderField label="Test" value={5} onChange={() => {}} min={0} max={100} sliderMin={10} sliderMax={90} />
    );
    expect(screen.getByText('<10')).toHaveClass('text-amber-600');
  });

  it('renders an opt-in, value-positioned split gradient and accessible legend', () => {
    render(
      <NumberSliderField
        label="ETF Allocation"
        value={40}
        onChange={() => {}}
        min={0}
        max={100}
        sliderMin={0}
        sliderMax={100}
        splitColor="etf"
        suffix="%"
      />
    );

    const slider = screen.getByLabelText('ETF Allocation slider');
    expect(slider).toHaveClass('range-slider-split-etf');
    expect(slider.style.backgroundImage).toContain('var(--slider-split-before) 40%');
    expect(slider.style.backgroundImage).toContain('var(--slider-split-after) 40%');
    expect(screen.getByLabelText('Offset-bound and ETF allocation slider legend')).toBeInTheDocument();
    expect(screen.getByText('Offset-bound')).toBeInTheDocument();
    expect(screen.getByText('ETF allocation')).toBeInTheDocument();
  });
});
