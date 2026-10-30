import { strict as assert } from 'node:assert';
import { type CloudAccountRoleAccessCredential } from '@cloud-idaas/pam-client-sdk';
import { IDaaSPamAwsCredentialsProvider, createAwsCredentialsProvider } from '../src';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

const quiet = { info() {}, warn() {}, error() {} };
function wire(): CloudAccountRoleAccessCredential {
  return {
    accessCredentialExpiresAt: Date.now() / 1000 + 3600,
    awsStsToken: { accessKeyId: 'ak', secretAccessKey: 'sk', sessionToken: 'session' },
  };
}
describe('AWS v3 credential adaptation', () => {
  it('signs requests through the provider using a real AWS v3 client', async () => {
    let session = '';
    const credentials = createAwsCredentialsProvider({
      roleExternalId: 'role',
      cache: { logger: quiet },
      pamClient: {
        async obtainAccessCredential() {
          return wire();
        },
      },
    });
    const client = new STSClient({
      region: 'us-east-1',
      credentials,
      endpoint: 'http://sts.test',
      maxAttempts: 1,
      requestHandler: {
        async handle(request: { headers: Record<string, string> }) {
          session = request.headers['x-amz-security-token'] || '';
          assert(request.headers.authorization?.includes('Credential=ak/'));
          return {
            response: {
              statusCode: 200,
              headers: { 'content-type': 'text/xml' },
              body: Buffer.from(
                '<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><GetCallerIdentityResult><Arn>arn:test</Arn><UserId>user</UserId><Account>account</Account></GetCallerIdentityResult><ResponseMetadata><RequestId>local</RequestId></ResponseMetadata></GetCallerIdentityResponse>',
              ),
            },
          };
        },
      },
    });
    try {
      assert.equal((await client.send(new GetCallerIdentityCommand({}))).UserId, 'user');
      assert.equal(session, 'session');
    } finally {
      client.destroy();
      credentials.close();
    }
  });
  it('returns an asynchronous credential function with independent Dates and coalesced cache refreshes', async () => {
    let calls = 0;
    const provider = createAwsCredentialsProvider({
      roleExternalId: 'role',
      pamClient: {
        async obtainAccessCredential(role) {
          assert.equal(role, 'role');
          calls++;
          return wire();
        },
      },
      cache: { logger: quiet },
    });
    const values = await Promise.all(Array.from({ length: 20 }, () => provider()));
    assert.equal(calls, 1);
    assert.equal(values[0]!.sessionToken, 'session');
    assert(values[0]!.expiration instanceof Date);
    values[0]!.expiration.setTime(0);
    assert((await provider()).expiration.getTime() > Date.now());
    provider.close();
    await assert.rejects(provider());
  });
  it('delivers refreshed credentials to the caller', async () => {
    let now = Date.now();
    let calls = 0;
    const provider = new IDaaSPamAwsCredentialsProvider({
      roleExternalId: 'role',
      cache: { clock: () => now, random: () => 0, logger: quiet },
      pamClient: {
        async obtainAccessCredential() {
          calls++;
          return {
            awsStsToken: {
              accessKeyId: `ak-${calls}`,
              secretAccessKey: 'sk',
              sessionToken: 'session',
              expiration: new Date(Date.now() + (calls === 1 ? 1000 : 3600_000)).toISOString(),
            },
          };
        },
      },
    });
    assert.equal((await provider.getCredentials()).accessKeyId, 'ak-1');
    now += 900;
    assert.equal((await provider.getCredentials()).accessKeyId, 'ak-2');
    provider.close();
  });
  it('rejects missing fields and expired credentials', async () => {
    const provider = createAwsCredentialsProvider({
      roleExternalId: 'role',
      cache: { logger: quiet },
      pamClient: {
        async obtainAccessCredential() {
          return { awsStsToken: { accessKeyId: 'ak' } };
        },
      },
    });
    await assert.rejects(provider());
    provider.close();
  });
});
