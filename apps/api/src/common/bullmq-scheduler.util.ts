import { Logger } from '@nestjs/common';
import { JobsOptions, Queue, RepeatOptions } from 'bullmq';

export interface RegisterRepeatableJobOptions {
  repeat: RepeatOptions;
  attempts?: number;
  backoff?: JobsOptions['backoff'];
}

/**
 * Registers a repeatable BullMQ job with a stable jobId.
 * Removes prior repeatable registrations for the same jobId or job name
 * so API restarts do not stack duplicate schedulers.
 */
export async function registerRepeatableJob(
  queue: Queue,
  jobName: string,
  jobId: string,
  options: RegisterRepeatableJobOptions,
  logger?: Logger,
): Promise<void> {
  const repeatables = await queue.getRepeatableJobs();
  for (const entry of repeatables) {
    if (entry.id === jobId || entry.name === jobName) {
      await queue.removeRepeatableByKey(entry.key);
      logger?.debug?.(`Removed stale repeatable job: ${entry.name} (${entry.key})`);
    }
  }

  await queue.add(jobName, {}, {
    jobId,
    repeat: options.repeat,
    attempts: options.attempts ?? 3,
    backoff: options.backoff ?? { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });

  logger?.log(`Repeatable job registered: ${jobName} (jobId=${jobId})`);
}