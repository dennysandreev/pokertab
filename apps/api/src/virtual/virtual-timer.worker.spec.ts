import { VirtualTimerWorker } from "./virtual-timer.worker";
import type { VirtualService } from "./virtual.service";

describe("VirtualTimerWorker", () => {
  const originalEnabled = process.env.VIRTUAL_TIMER_WORKER_ENABLED;
  const originalInterval = process.env.VIRTUAL_TIMER_POLL_INTERVAL_MS;

  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.VIRTUAL_TIMER_WORKER_ENABLED;
    delete process.env.VIRTUAL_TIMER_POLL_INTERVAL_MS;
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreEnv("VIRTUAL_TIMER_WORKER_ENABLED", originalEnabled);
    restoreEnv("VIRTUAL_TIMER_POLL_INTERVAL_MS", originalInterval);
    jest.restoreAllMocks();
  });

  it("does not start when disabled", async () => {
    process.env.VIRTUAL_TIMER_WORKER_ENABLED = "false";
    const processDueTurnTimers = jest.fn(() =>
      Promise.resolve({ reminders: [], timeouts: [] })
    );
    const processDueCompletedHands = jest.fn(() => Promise.resolve());
    const worker = new VirtualTimerWorker(
      createVirtualServiceMock(processDueTurnTimers, processDueCompletedHands)
    );

    worker.onModuleInit();
    await jest.runOnlyPendingTimersAsync();

    expect(processDueTurnTimers).not.toHaveBeenCalled();
    expect(processDueCompletedHands).not.toHaveBeenCalled();
  });

  it("runs on startup and on the next interval tick", async () => {
    process.env.VIRTUAL_TIMER_POLL_INTERVAL_MS = "50";
    let receivedNow: Date | undefined;
    const processDueTurnTimers = jest.fn((now?: Date) => {
      receivedNow = now;
      return Promise.resolve({ reminders: [], timeouts: [] });
    });
    const processDueCompletedHands = jest.fn(() => Promise.resolve());
    const worker = new VirtualTimerWorker(
      createVirtualServiceMock(processDueTurnTimers, processDueCompletedHands)
    );

    worker.onModuleInit();
    await Promise.resolve();

    expect(processDueTurnTimers).toHaveBeenCalledTimes(1);
    expect(processDueCompletedHands).toHaveBeenCalledTimes(1);
    expect(receivedNow).toBeInstanceOf(Date);

    await jest.advanceTimersByTimeAsync(50);

    expect(processDueTurnTimers).toHaveBeenCalledTimes(2);
    expect(processDueCompletedHands).toHaveBeenCalledTimes(2);
  });

  it("skips overlapping runs", async () => {
    let resolveRun: (() => void) | undefined;
    const processDueTurnTimers = jest.fn(
      () =>
        new Promise<{ reminders: []; timeouts: [] }>((resolve) => {
          resolveRun = () => resolve({ reminders: [], timeouts: [] });
        })
    );
    const processDueCompletedHands = jest.fn(() => Promise.resolve());
    const worker = new VirtualTimerWorker(
      createVirtualServiceMock(processDueTurnTimers, processDueCompletedHands)
    );

    const firstRun = worker.runOnce(new Date("2026-05-13T10:00:00.000Z"));
    const secondRun = worker.runOnce(new Date("2026-05-13T10:00:01.000Z"));

    expect(processDueTurnTimers).toHaveBeenCalledTimes(1);
    expect(processDueCompletedHands).not.toHaveBeenCalled();

    const completeRun = resolveRun;
    if (completeRun) {
      completeRun();
    }
    await firstRun;
    await secondRun;
    expect(processDueCompletedHands).toHaveBeenCalledTimes(1);
  });

  it("clears the interval on destroy", async () => {
    process.env.VIRTUAL_TIMER_POLL_INTERVAL_MS = "50";
    const processDueTurnTimers = jest.fn(() =>
      Promise.resolve({ reminders: [], timeouts: [] })
    );
    const processDueCompletedHands = jest.fn(() => Promise.resolve());
    const worker = new VirtualTimerWorker(
      createVirtualServiceMock(processDueTurnTimers, processDueCompletedHands)
    );

    worker.onModuleInit();
    await Promise.resolve();
    expect(processDueTurnTimers).toHaveBeenCalledTimes(1);
    expect(processDueCompletedHands).toHaveBeenCalledTimes(1);

    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(150);

    expect(processDueTurnTimers).toHaveBeenCalledTimes(1);
    expect(processDueCompletedHands).toHaveBeenCalledTimes(1);
  });

  it("logs turn-timer and completed-hand failures independently in one tick", async () => {
    const stderrWriteSpy = jest.spyOn(process.stderr, "write").mockReturnValue(true);
    const processDueTurnTimers = jest.fn(() => Promise.reject(new Error("turn timers boom")));
    const processDueCompletedHands = jest.fn(() =>
      Promise.reject(new Error("completed hands boom"))
    );
    const worker = new VirtualTimerWorker(
      createVirtualServiceMock(processDueTurnTimers, processDueCompletedHands)
    );

    await worker.runOnce(new Date("2026-05-13T10:00:00.000Z"));

    expect(processDueTurnTimers).toHaveBeenCalledTimes(1);
    expect(processDueCompletedHands).toHaveBeenCalledTimes(1);
    expect(stderrWriteSpy).toHaveBeenCalledWith(
      "[VirtualTimerWorker] processDueTurnTimers failed: turn timers boom\n"
    );
    expect(stderrWriteSpy).toHaveBeenCalledWith(
      "[VirtualTimerWorker] processDueCompletedHands failed: completed hands boom\n"
    );
  });
});

function createVirtualServiceMock(
  processDueTurnTimers: VirtualService["processDueTurnTimers"],
  processDueCompletedHands: VirtualService["processDueCompletedHands"]
): VirtualService {
  return {
    processDueTurnTimers,
    processDueCompletedHands
  } as unknown as VirtualService;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
