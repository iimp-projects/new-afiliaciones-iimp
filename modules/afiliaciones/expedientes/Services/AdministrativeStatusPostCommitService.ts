export interface IntegrationPostCommitProcessor {
  processAfterCommit(integrationId: number): Promise<void>;
}

export async function processPreparedStudentIntegrationAfterCommit(
  integrationId: number | null,
  associatesIntegrationService: IntegrationPostCommitProcessor
) {
  if (integrationId !== null) {
    await associatesIntegrationService.processAfterCommit(integrationId);
  }
}
