import { createErrorMessage, Initializable, isSystemError, setSafeInterval } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { Parser, Store, Writer } from 'n3';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { MemoryUCRulesStorage } from './MemoryUCRulesStorage';

/**
 * Backs up all the stored policies to a backup file every 5 minutes (default).
 * Reads the policies from this file on startup.
 * If no file path is defined, this is just a MemoryUCRulesStorage.
 */
export class FileBackupUCRulesStorage extends MemoryUCRulesStorage implements Initializable {
  protected readonly logger = getLoggerFor(this);

  protected doingBackup = false;
  protected dataChanged = false;

  public constructor(protected readonly filePath?: string, interval = 5 * 60) {
    super();
    this.logger.info(`STARTING ${filePath}`);
    if (filePath) {
      const timer = setSafeInterval(
        this.logger,
        'Failed to backup policies',
        this.backup.bind(this),
        interval * 1000);
      timer.unref();
    }
  }

  public async initialize(): Promise<void> {
    this.logger.info('CALLING INITIALIZE');
    if (!this.filePath) {
      return;
    }
    this.logger.info(`Reading policy backup from ${this.filePath}`);
    const parser = new Parser();
    const stream = createReadStream(this.filePath, 'utf8');
    parser.parse(stream, (err, quad) => {
      if (err) {
        if (isSystemError(err) && err.code === 'ENOENT') {
          this.logger.info(`No backup file found at ${this.filePath}`);
          return;
        }
        this.logger.error(`Problem parsing backup policies file: ${createErrorMessage(err)}`);
      }
      if (quad) {
        this.store.add(quad);
      }
    });
  }

  protected async backup(): Promise<void> {
    if (!this.filePath || this.doingBackup || !this.dataChanged) {
      return;
    }
    this.doingBackup = true;
    this.logger.info(`Creating policy backup in ${this.filePath}`);
    try {
      // Move the previous backup just in case of a crash during backup
      const oldPath = this.filePath + '.old';
      let removeOld = false;
      try {
        await rename(this.filePath, oldPath);
        removeOld = true;
      } catch (error: unknown) {
        if (!isSystemError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Backup the triples
      const stream = createWriteStream(this.filePath, 'utf8');
      const writer = new Writer(stream);
      writer.addQuads(this.store.getQuads(null, null, null, null));
      writer.end();
      this.dataChanged = false;

      // Remove the previous backup
      if (removeOld) {
        await unlink(oldPath);
      }
    } finally {
      this.doingBackup = false;
    }
  }

  public async addRule(rule: Store): Promise<void> {
    this.dataChanged = true;
    return super.addRule(rule);
  }

  public async deleteRule(identifier: string): Promise<void> {
    this.dataChanged = true;
    return super.deleteRule(identifier);
  }

  public async deleteRuleFromPolicy(ruleID: string, PolicyID: string): Promise<void> {
    this.dataChanged = true;
    return super.deleteRuleFromPolicy(ruleID, PolicyID);
  }

  public async removeData(data: Store): Promise<void> {
    this.dataChanged = true;
    return super.removeData(data);
  }
}
