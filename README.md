# IDaaS AWS Credentials Adapter

[Simplified Chinese](README_zh.md) | English

Use IDaaS PAM temporary credentials with AWS SDK for JavaScript v3.

## Requirements and installation

Supports Node.js 20, 22, and 24, JavaScript CommonJS/ESM, and TypeScript 4.7 or later. This is a Node.js SDK, not a browser SDK. Check your registry for available beta versions; use a provided package archive when evaluating an unreleased version.

```sh
npm install @cloud-idaas/core-sdk @cloud-idaas/akless-aws-adapter
```

## Usage

Configure Core using CLOUD_IDAAS_CONFIG_PATH or ~/.cloud_idaas/client-config.json. Provide developerApiEndpoint and an identity authorized for PAM access. Replace example identifiers with your settings. Save the following ESM example as `example.mjs` and run it with Node.js. CommonJS uses the same named exports through `require`; asynchronous calls belong inside an async function.

```javascript
import { IDaaSCredentialProviderFactory } from '@cloud-idaas/core-sdk';
import { createAwsCredentialsProvider } from '@cloud-idaas/akless-aws-adapter';

await IDaaSCredentialProviderFactory.init();
try {
  const credentials = createAwsCredentialsProvider('role-external-id');
  try {
    await credentials();
    // Pass credentials to new S3Client({ region: '...', credentials }).
    // Await all service requests before closing the provider.
  } finally {
    credentials.close();
  }
} finally {
  await IDaaSCredentialProviderFactory.close();
}
```

## Integration notes

Pass the function returned by `createAwsCredentialsProvider()` to the AWS SDK v3 client's `credentials` option. Install the required AWS service client separately. Avoid replacing the function with a credential snapshot for long-running applications.

The options object accepts `roleExternalId`, `developerApiEndpoint`, `idaasInstanceId`, and `credentialProvider`. Credentials include an expiration time, and retrieval/refresh failures raise SDK errors. Keep the provider open until AWS requests finish, then call `close()`.

`httpConfiguration.userAgent` customizes requests to IDaaS; AWS service requests follow the AWS client's configuration. Caller-injected providers and clients remain caller-owned.

## Examples and support

See [examples](examples) for CommonJS, ESM, and TypeScript samples. Report issues through [GitHub Issues](https://github.com/cloud-idaas/idaas-typescript-akless-aws-adapter/issues). Development instructions are in the repository's [contribution guide](https://github.com/cloud-idaas/idaas-typescript-akless-aws-adapter/blob/master/CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE).
