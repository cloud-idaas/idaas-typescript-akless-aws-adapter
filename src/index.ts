import { CredentialException } from '@cloud-idaas/core-sdk';
import {
  type AklessProviderOptions,
  AklessProviderBuilder,
  CachedCloudCredentialProvider,
  type ExpiringCredential,
  credentialExpiration,
  credentialString,
} from '@cloud-idaas/pam-client-sdk';

/** AWS STS snapshot mapped from PAM, with expiration as an ISO 8601 timestamp. */
export interface AwsSessionCredentials extends ExpiringCredential {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}
/** Structural AWS SDK v3 identity; every returned Date is an independent object. */
export interface AwsCredentialIdentity {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}
/**
 * Asynchronous AWS SDK v3 credential function with explicit resource cleanup.
 * @remarks Fetches STS credentials on first use; refresh failures after expiration reject instead of returning expired credentials.
 */
export interface AwsCredentialsProvider {
  /** @returns An independent credential snapshot for request signing; rejects with IDaaSException on failure. */
  (): Promise<AwsCredentialIdentity>;
  /** Closes owned PAM/HTTP resources, leaving the caller's AWS client and injected resources open. */
  close(): void;
}
/**
 * IDaaS PAM dynamic credential adapter for AWS SDK v3 on Node.js 20/22/24.
 * @remarks The signing integration was verified with @aws-sdk/client-sts 3.1152.0. Inherited getCredentials
 * returns an ISO expiration snapshot; toAwsCredentialsProvider converts it to Date at the adapter boundary.
 * Callers must call close; injected PAM, HTTP, and machine credential sources remain caller-owned.
 */
export class IDaaSPamAwsCredentialsProvider extends CachedCloudCredentialProvider<AwsSessionCredentials> {
  /** @returns A role configuration builder without I/O; build preserves constructor validation and resource ownership. */
  static builder(): AklessProviderBuilder<IDaaSPamAwsCredentialsProvider> {
    return new AklessProviderBuilder((options) => new IDaaSPamAwsCredentialsProvider(options));
  }
  /**
   * Creates a provider without fetching STS credentials.
   * @param options - Required role and optional PAM, HTTP, machine credential source, and cache configuration.
   * @throws ConfigException - The configuration is invalid or the required default factory is not initialized.
   */
  constructor(options: AklessProviderOptions) {
    super(options, (response) => {
      const token = response.awsStsToken;
      if (!token)
        throw new CredentialException(
          'Response is missing awsStsToken',
          'InvalidCredentialResponse',
        );
      return {
        accessKeyId: credentialString(token.accessKeyId, 'accessKeyId'),
        secretAccessKey: credentialString(token.secretAccessKey, 'secretAccessKey'),
        sessionToken: credentialString(token.sessionToken, 'sessionToken'),
        expiration: new Date(credentialExpiration(response, token.expiration)).toISOString(),
      };
    });
  }
  /**
   * Wraps this provider as an AWS SDK v3 credentials function without creating another cache or fetching credentials.
   * @returns A function sharing this provider; calling its close also closes this provider.
   * @remarks Every call returns an independent Date; asynchronous retrieval failures reject with IDaaSException.
   */
  toAwsCredentialsProvider(): AwsCredentialsProvider {
    const resolve = async (): Promise<AwsCredentialIdentity> => {
      const value = await this.getCredentials();
      this.assertAvailable(value);
      return { ...value, expiration: new Date(value.expiration) };
    };
    resolve.close = () => this.close();
    return resolve;
  }
}
/**
 * Creates a function accepted directly by the AWS SDK v3 credentials option.
 * @param roleOrOptions - Role external ID or complete configuration including the role.
 * @param options - Additional configuration when the first argument is a string; injected sources take precedence.
 * @returns An independent dynamic provider with close; fetches STS on first use and must be closed by the caller.
 * @throws ConfigException - The configuration is invalid or the required default factory is not initialized.
 * @remarks Request and expiration failures reject with IDaaSException; close leaves the AWS client
 * and caller-injected shared resources open.
 */
export function createAwsCredentialsProvider(
  roleOrOptions: string | AklessProviderOptions,
  options: Omit<AklessProviderOptions, 'roleExternalId'> = {},
): AwsCredentialsProvider {
  return new IDaaSPamAwsCredentialsProvider(
    typeof roleOrOptions === 'string'
      ? { ...options, roleExternalId: roleOrOptions }
      : roleOrOptions,
  ).toAwsCredentialsProvider();
}
/** AWS beta convenience factories; do not create AWS service clients. */
export class IDaaSPamAklessCredentialFactory {
  /** Creates a dynamic credentials function with the same arguments, errors, and lifecycle as the named factory. */
  static createAwsCredentialsProvider = createAwsCredentialsProvider;
}
