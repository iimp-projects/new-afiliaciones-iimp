import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import confetti from "canvas-confetti";
import { fireSubmissionConfetti } from "./celebration";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("fireSubmissionConfetti", () => {
  let matchMedia: ReturnType<typeof vi.fn>;
  let setInterval: ReturnType<typeof vi.fn>;
  let clearInterval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    matchMedia = vi.fn().mockReturnValue({ matches: false });
    setInterval = vi.fn().mockReturnValue(1);
    clearInterval = vi.fn();
    vi.stubGlobal("window", { matchMedia, setInterval, clearInterval });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("dispara una sola vez por envío exitoso (guard)", () => {
    const ref = { current: false };
    fireSubmissionConfetti(ref);
    fireSubmissionConfetti(ref);

    expect(ref.current).toBe(true);
    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  it("no dispara cuando prefers-reduced-motion está activo", () => {
    matchMedia.mockReturnValue({ matches: true });
    const ref = { current: false };
    fireSubmissionConfetti(ref);

    expect(ref.current).toBe(false);
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("invoca canvas-confetti al confirmarse el éxito", () => {
    let intervalCallback: (() => void) | null = null;
    setInterval.mockImplementation((callback: () => void) => {
      intervalCallback = callback;
      return 1;
    });

    const ref = { current: false };
    fireSubmissionConfetti(ref);
    expect(ref.current).toBe(true);
    expect(confetti).not.toHaveBeenCalled();

    intervalCallback!();
    expect(confetti).toHaveBeenCalled();
  });
});
