import { mkdir, open, readFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { hash } from "@promisory/domain";
import {
  journalRecordSchema,
  type ExecutionJournal,
  type JournalRecord,
} from "@promisory/integrations-decionis";
/** Single-host durable journal. Multi-replica hosting must replace this with a shared CAS store. */
export class FileExecutionJournal implements ExecutionJournal {
  constructor(private directory: string) {
    this.directory = resolve(directory);
  }
  private async path(installation: string, operation: string) {
    return join(
      this.directory,
      `${(await hash([installation, operation])).slice(7)}.json`,
    );
  }
  async get(installation: string, operation: string) {
    try {
      return journalRecordSchema.parse(
        JSON.parse(
          await readFile(await this.path(installation, operation), "utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  async start(record: JournalRecord) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    let file;
    try {
      file = await open(
        await this.path(
          record.envelope.context.installationId,
          record.envelope.operationId,
        ),
        "wx",
        0o600,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
    try {
      await file.writeFile(JSON.stringify(journalRecordSchema.parse(record)));
      await file.sync();
    } finally {
      await file.close();
    }
    await this.syncDirectory();
    return true;
  }
  async save(record: JournalRecord) {
    const target = await this.path(
        record.envelope.context.installationId,
        record.envelope.operationId,
      ),
      temp = `${target}.${crypto.randomUUID()}.tmp`;
    const file = await open(temp, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(journalRecordSchema.parse(record)));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temp, target);
    await this.syncDirectory();
  }
  private async syncDirectory() {
    const directory = await open(this.directory, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
