import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { VirtualService } from "./virtual.service";

const DEFAULT_POLL_INTERVAL_MS = 5_000;

@Injectable()
export class VirtualTimerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly enabled = readWorkerEnabled(process.env.VIRTUAL_TIMER_WORKER_ENABLED);
  private readonly pollIntervalMs = readPollIntervalMs(
    process.env.VIRTUAL_TIMER_POLL_INTERVAL_MS
  );
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(private readonly virtualService: VirtualService) {}

  onModuleInit(): void {
    if (!this.enabled || this.timer !== null) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.pollIntervalMs);

    void this.runOnce();
  }

  onModuleDestroy(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now: Date = new Date()): Promise<void> {
    if (!this.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.virtualService.processDueTurnTimers(now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[VirtualTimerWorker] processDueTurnTimers failed: ${message}\n`);
    }

    try {
      await this.virtualService.processDueCompletedHands(now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[VirtualTimerWorker] processDueCompletedHands failed: ${message}\n`);
    } finally {
      this.isRunning = false;
    }
  }
}

function readWorkerEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}

function readPollIntervalMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  return parsed;
}
