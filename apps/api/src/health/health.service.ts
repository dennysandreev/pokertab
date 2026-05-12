import { Injectable } from "@nestjs/common";

export type HealthStatus = {
  ok: true;
};

@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    return { ok: true };
  }
}

