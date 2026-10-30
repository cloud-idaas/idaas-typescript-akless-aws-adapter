# IDaaS AWS Credentials Adapter

简体中文 | [English](README.md)

将 IDaaS PAM 临时凭证用于 AWS SDK for JavaScript v3。

## 环境与安装

支持 Node.js 20、22、24，JavaScript CommonJS/ESM 以及 TypeScript 4.7 及以上版本。本 SDK 用于 Node.js，不用于浏览器。请以 npm registry 中的实际可用版本为准；评估尚未发布的版本时，使用提供的安装包归档。

```sh
npm install @cloud-idaas/core-sdk @cloud-idaas/akless-aws-adapter
```

## 使用

通过 CLOUD_IDAAS_CONFIG_PATH 或 ~/.cloud_idaas/client-config.json 配置 Core，提供 developerApiEndpoint 及已获 PAM 访问授权的身份，并替换示例标识。 将以下 ESM 示例保存为 `example.mjs`，通过 Node.js 运行。CommonJS 使用相同的具名导出和 `require`，异步调用放在 async 函数中。

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

## 集成说明

将 `createAwsCredentialsProvider()` 返回的函数传给 AWS SDK v3 客户端的 `credentials` 选项，并另行安装需要的 AWS 服务客户端。长时间运行的应用应保留该函数，不要改用一次性凭证快照。

配置对象支持 `roleExternalId`、`developerApiEndpoint`、`idaasInstanceId` 和 `credentialProvider`。返回的凭证包含过期时间，获取或刷新失败时抛出 SDK 异常。AWS 请求完成前保持提供者可用，随后调用 `close()`。

`httpConfiguration.userAgent` 定制发往 IDaaS 的请求；AWS 服务请求遵循 AWS 客户端配置。注入的提供者和客户端仍由调用方管理。

## 示例与支持

[examples](examples) 提供 CommonJS、ESM 和 TypeScript 示例。问题反馈请使用 [GitHub Issues](https://github.com/cloud-idaas/idaas-typescript-akless-aws-adapter/issues)，开发说明见源码仓库的[贡献指南](https://github.com/cloud-idaas/idaas-typescript-akless-aws-adapter/blob/master/CONTRIBUTING.md)。

## 许可证

[Apache License 2.0](LICENSE)。
