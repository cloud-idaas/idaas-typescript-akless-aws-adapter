const { IDaaSCredentialProviderFactory } = require('@cloud-idaas/core-sdk');
const { createAwsCredentialsProvider } = require('@cloud-idaas/akless-aws-adapter');

async function main() {
  await IDaaSCredentialProviderFactory.init();
  try {
    const credentials = createAwsCredentialsProvider(
      process.env.IDAAS_ROLE_EXTERNAL_ID || 'role-id',
    );
    try {
      await credentials();
    } finally {
      credentials.close();
    }
  } finally {
    await IDaaSCredentialProviderFactory.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SDK call failed');
  process.exitCode = 1;
});
