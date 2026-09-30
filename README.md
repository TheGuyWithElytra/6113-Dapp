# 文件指纹登记 dapp

独立新项目，支持手机 MetaMask 内置浏览器与电脑钱包扩展，使用 Sepolia 测试网。

## 功能

- 在设备本地计算文件原始字节的 SHA-256；文件内容和文件名不上传。
- 在钱包中部署 FileFingerprintRegistry 合约，或加载已有地址。
- 将 bytes32 指纹登记上链，记录首次登记钱包、区块时间，并发出事件。
- 相同指纹在同一合约中只能登记一次，任何人都不能覆盖或删除首次记录。
- 重新选择文件或粘贴指纹，查询是否登记及首次登记者和时间。
- 仅保存合约地址到浏览器本地存储，不保存文件。

登记是此合约内的公开记录，不证明作者身份、版权或所有权，也不是全球唯一登记。所有设备必须使用同一个登记合约。修改文件字节会改变指纹，改名不会。文件上限 50 MiB，避免手机一次性读取过大文件。

## GitHub 和 Render

创建一个新的 GitHub 仓库 `file-fingerprint-dapp`，上传本文件夹内容（不要上传 node_modules 或 dist）。在 Render 选择 New → Static Site，连接新仓库：

| 设置 | 值 |
|---|---|
| Branch | main |
| Root Directory | 留空（本文件夹内容位于仓库根目录时） |
| Build Command | npm ci && npm run build |
| Publish Directory | dist |

也可以通过 New → Blueprint 使用 render.yaml。无需环境变量或私钥。参考 https://render.com/docs/static-sites 。网站发布和区块链合约部署是两件事。

## 首次使用

1. 在手机 MetaMask 的内置浏览器打开 Render HTTPS 地址。
2. 连接钱包，选择 Sepolia，准备 Sepolia 测试 ETH。
3. 展开“还没有登记合约？”，点击“部署登记合约”，在钱包中确认。
4. 保存自动填入的合约地址。其他用户使用同一地址加载此合约。
5. 选择文件，等待指纹计算完成，点击“注册文件指纹”并在钱包中确认。
6. 以后选择同一文件，点击“查询链上记录”，即可查看首次登记钱包和时间。

可分享 `https://你的网址.onrender.com/?address=0x你的合约地址`，自动填写合约地址。原 SimpleStorage 合约不能用于这个新项目。

## 本地构建和测试

需要 Node.js 20.19+ 或 22.12+。

```
npm ci
npm run build
npm test
npm run dev
```

浏览器测试：安装 Playwright Chromium 后执行 `node scripts/check-browser.mjs`；Windows 有 Edge 时可在 PowerShell 先设置 `$env:BROWSER_CHANNEL='msedge'`。

测试覆盖 SHA-256 已知值、空文件、改名不改变指纹、修改内容改变指纹、大小与格式校验，真实本地链部署、登记、时间与事件、重复登记拒绝及首次记录保护，手机与电脑布局和完整交互。尚未使用真实手机或用户钱包进行 Sepolia 交易。
