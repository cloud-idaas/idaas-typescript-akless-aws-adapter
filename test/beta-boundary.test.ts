import { strict as assert } from 'node:assert';
import { IDaaSPamAwsCredentialsProvider } from '../src';

describe('Beta regression: expiration and closure checks before cloud credential delivery', () => {
  it('rejects delivery when credentials expire or the provider closes during the outer await', async () => {
    for (const transition of ['expire', 'close']) {
      {
        let now = Date.now();
        const expiresAt = now + 3600000;
        const expiration = new Date(expiresAt).toISOString();
        const source = new IDaaSPamAwsCredentialsProvider({
          roleExternalId: 'role',
          cache: { clock: () => now, logger: { info() {}, warn() {}, error() {} } },
          pamClient: {
            async obtainAccessCredential() {
              return {
                awsStsToken: {
                  accessKeyId: 'id',
                  secretAccessKey: 'key',
                  sessionToken: 'session',
                  expiration,
                },
              };
            },
          },
        });
        try {
          const valid = await source.getCredentials();
          const read = source.toAwsCredentialsProvider();
          // Replace only the public credential source to isolate delivery races after the final await.
          source.getCredentials = async () => {
            queueMicrotask(() => {
              if (transition === 'close') source.close();
              else now = expiresAt;
            });
            return { ...valid };
          };
          await assert.rejects(read(), {
            errorCode: transition === 'close' ? 'Closed' : 'InvalidExpiration',
          });
        } finally {
          source.close();
        }
      }
    }
  });
});
