import { render, fireEvent } from '@testing-library/react';
import { ContrastProvider, useContrast } from './ContrastContext';
import { useEffect } from 'react';

function TestComponent() {
  const { contrastMode, toggleContrast } = useContrast();
  useEffect(() => {
    (window as any).currentContrast = contrastMode;
  }, [contrastMode]);
  return <button onClick={toggleContrast}>Toggle</button>;
}

test('toggles high‑contrast attribute on html element', () => {
  render(
    <ContrastProvider>
      <TestComponent />
    </ContrastProvider>
  );
  const button = document.querySelector('button')!;
  expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  fireEvent.click(button);
  expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  fireEvent.click(button);
  expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
});
