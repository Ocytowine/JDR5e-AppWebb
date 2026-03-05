import fs from "node:fs";
import path from "node:path";

export class TurnTraceLogger {
  private outputFile: string;

  constructor(outputFile: string) {
    this.outputFile = outputFile;
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
  }

  append(trace: Record<string, unknown>): void {
    const payload = {
      logged_at_utc: new Date().toISOString(),
      ...trace,
    };
    fs.appendFileSync(this.outputFile, `${JSON.stringify(payload)}\n`, "utf-8");
  }
}

