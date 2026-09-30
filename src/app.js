import './style.css';
import { BrowserProvider, Contract, ContractFactory, isAddress, getAddress, ZeroAddress } from 'ethers';
import artifact from './contract.json';
import { hashFile, normalizeFingerprint } from './fingerprint.js';
const $ = id=>document.getElementById(id);
const CHAIN = 11155111n;
let provider, signer, loadedAddress, busy=false, session=0, checked, fileVersion=0;
function message(text, kind='') { $('status').textContent=text; $('status').className=`status ${kind}`; }
function clearRecord() { checked=undefined; $('result').textContent='尚未查询'; $('record-details').hidden=true; }
function digest() { return normalizeFingerprint($('fingerprint').value); }
function validDigest() { try {digest(); return true;} catch {return false;} }
function sync() {
  for(const id of ['connect','switch','address','fingerprint','file']) $(id).disabled=busy;
  $('deploy').disabled=busy || !signer;
  $('load').disabled=busy || !signer || !isAddress($('address').value.trim());
  $('verify').disabled=busy || !loadedAddress || !signer || !validDigest();
  $('register').disabled=$('verify').disabled || checked?.registered===true;
}
function errorText(e) {
  if(e.code===4001 || e.code==='ACTION_REJECTED') return '你已在钱包中取消操作。';
  if(e.code==='INSUFFICIENT_FUNDS') return '钱包需要 Sepolia 测试 ETH 支付交易费用。';
  if(e.revert?.name==='AlreadyRegistered' || e.message?.includes('AlreadyRegistered')) return '该指纹已被登记，不能重复注册。请重新查询记录。';
  if(e.code==='CALL_EXCEPTION' || e.code==='BAD_DATA') return '操作失败，请确认合约地址正确，或重新查询该指纹是否已登记。';
  return e.shortMessage || e.message || '操作失败，请重试。';
}
async function run(action) {if(busy)return; busy=true;sync();try{await action();}catch(e){message(errorText(e),'error');}finally{busy=false;sync();}}
function link(hash) {$('transaction').href=`https://sepolia.etherscan.io/tx/${hash}`; $('transaction').hidden=false;}
async function requireNetwork() {if(!signer)throw new Error('请先连接 Sepolia 钱包。');if(BigInt(await window.ethereum.request({method:'eth_chainId'}))!==CHAIN)throw new Error('请切换到 Sepolia 网络。');}
function invalidate() {session++; signer=undefined;provider=undefined;loadedAddress=undefined;clearRecord();$('wallet').textContent='未连接';$('network').textContent='未连接';$('switch').hidden=true;$('transaction').hidden=true;message('钱包账户或网络已改变，请重新连接。');sync();}
async function connect() {
  if(!window.ethereum)throw new Error('请在 MetaMask 手机内置浏览器打开本网站，或使用电脑钱包扩展。');
  const version=session;provider=new BrowserProvider(window.ethereum);await provider.send('eth_requestAccounts',[]);
  const accounts=await provider.send('eth_accounts',[]);const network=await provider.getNetwork();
  if(version!==session)return;
  $('wallet').textContent=`${accounts[0].slice(0,6)}…${accounts[0].slice(-4)}`;$('network').textContent=network.chainId===CHAIN?'Sepolia':`Chain ${network.chainId}`;
  $('switch').hidden=network.chainId===CHAIN;signer=network.chainId===CHAIN?await provider.getSigner():undefined;
  $('connect').textContent='重新连接钱包';
  if(!signer){message('钱包已连接，请切换到 Sepolia。');return;}
  $('mobile-help').hidden=true;message('钱包已连接，请加载或部署登记合约。','success');
}
async function load() {
  loadedAddress=undefined;clearRecord();await requireNetwork();const version=session;
  const address=getAddress($('address').value.trim());
  if(await provider.getCode(address)==='0x')throw new Error('Sepolia 上此地址没有合约。');
  // Probe the expected read function before enabling writes.
  await new Contract(address,artifact.abi,provider).records('0x'+'00'.repeat(32));
  if(version!==session)return;loadedAddress=address;
  try{localStorage.setItem('fileFingerprint:sepolia',address);}catch{}
  message('登记合约已加载，可以查询或注册文件指纹。','success');
}
async function deploy() {
  await requireNetwork();const version=session;message('请在钱包中确认部署登记合约。');$('transaction').hidden=true;
  const contract=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy();
  link(contract.deploymentTransaction().hash);message('部署交易已发送，等待区块确认…');await contract.waitForDeployment();
  if(version!==session)return;$('address').value=await contract.getAddress();await load();message('登记合约部署成功。请保存此地址，以便其他设备查询同一份记录。','success');
}
async function query() {
  await requireNetwork();if(!loadedAddress)throw new Error('请先加载登记合约。');
  const fingerprint=digest(), version=session;const result=await new Contract(loadedAddress,artifact.abi,provider).records(fingerprint);
  if(version!==session)return;
  checked={registered:result.registrant!==ZeroAddress,fingerprint};
  $('record-details').hidden=!checked.registered;
  $('result').textContent=checked.registered?'已登记 · 文件指纹匹配':'此合约尚未登记该指纹';
  if(checked.registered){$('registrant').textContent=result.registrant;$('registrant').href=`https://sepolia.etherscan.io/address/${result.registrant}`;$('registered-at').textContent=new Date(Number(result.registeredAt)*1000).toLocaleString();}
  return checked;
}
async function register() {
  await requireNetwork();const version=session,address=loadedAddress,fingerprint=digest();
  const record=await query();if(!record || version!==session)return;
  if(record.registered){message('该指纹已经登记，首次记录不能覆盖。','success');return;}
  $('transaction').hidden=true;message('请在钱包中确认注册文件指纹，仅指纹会写入链上。');
  const tx=await new Contract(address,artifact.abi,signer).register(fingerprint);link(tx.hash);message('注册交易已发送，等待区块确认…');
  const receipt=await tx.wait();if(!receipt || receipt.status!==1)throw new Error('注册交易未成功。');
  if(version!==session)return;await query();message('文件指纹注册成功，链上记录已确认。','success');
}
$('connect').onclick=()=>run(connect);$('load').onclick=()=>run(load);$('deploy').onclick=()=>run(deploy);
$('verify').onclick=()=>run(async()=>{message('正在查询链上记录…');await query();message('查询完成，结果仅适用于当前登记合约。','success');});
$('register').onclick=()=>run(register);
$('switch').onclick=()=>run(async()=>{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});await connect();});
$('address').oninput=()=>{loadedAddress=undefined;clearRecord();$('transaction').hidden=true;sync();};
$('fingerprint').oninput=()=>{fileVersion++;$('file').value='';$('file-info').textContent='正在使用手动输入的指纹。';clearRecord();$('transaction').hidden=true;sync();};
$('file').onchange=()=>run(async()=>{
  const version=++fileVersion;const file=$('file').files[0];$('fingerprint').value='';clearRecord();$('transaction').hidden=true;
  if(!file){$('file-info').textContent='请选择文件。';return;}
  $('file-info').textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MiB`;message('正在本机计算 SHA-256 指纹…');
  const hash=await hashFile(file);if(version!==fileVersion)return;$('fingerprint').value=hash;message('指纹计算完成。文件内容与文件名未上传。','success');
});
window.ethereum?.on?.('accountsChanged',invalidate);window.ethereum?.on?.('chainChanged',invalidate);
try{const address=new URL(location.href).searchParams.get('address') || localStorage.getItem('fileFingerprint:sepolia');if(address && isAddress(address))$('address').value=address;}catch{}
if(location.protocol==='https:')$('open-wallet').href=`https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}`;
sync();
