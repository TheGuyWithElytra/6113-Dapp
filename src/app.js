import './style.css';
import { BrowserProvider, Contract, ContractFactory, isAddress, getAddress, ZeroAddress } from 'ethers';
import artifact from './contract.json';
import { hashFile, normalizeFingerprint } from './fingerprint.js';
const $ = id=>document.getElementById(id);
const CHAIN = 11155111n;
let provider, signer, loadedAddress, busy=false, session=0, checked, fileVersion=0;
function message(text, kind='') { $('status').textContent=text; $('status').className=`status ${kind}`; }
function clearRecord() { checked=undefined; $('result').textContent='Not checked yet'; $('record-details').hidden=true; }
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
  if(e.code===4001 || e.code==='ACTION_REJECTED') return 'Request cancelled in your wallet.';
  if(e.code==='INSUFFICIENT_FUNDS') return 'Your wallet needs Sepolia test ETH for transaction fees.';
  if(e.revert?.name==='AlreadyRegistered' || e.message?.includes('AlreadyRegistered')) return 'This fingerprint is already registered. Check its record again.';
  if(e.code==='CALL_EXCEPTION' || e.code==='BAD_DATA') return 'Request failed. Check the contract address or check whether this fingerprint is already registered.';
  return e.shortMessage || e.message || 'Request failed. Please try again.';
}
async function run(action) {if(busy)return; busy=true;sync();try{await action();}catch(e){message(errorText(e),'error');}finally{busy=false;sync();}}
function link(hash) {$('transaction').href=`https://sepolia.etherscan.io/tx/${hash}`; $('transaction').hidden=false;}
async function requireNetwork() {if(!signer)throw new Error('Connect your wallet on Sepolia first.');if(BigInt(await window.ethereum.request({method:'eth_chainId'}))!==CHAIN)throw new Error('Switch your wallet to Sepolia first.');}
function invalidate() {session++; signer=undefined;provider=undefined;loadedAddress=undefined;clearRecord();$('wallet').textContent='Not connected';$('network').textContent='Not connected';$('switch').hidden=true;$('transaction').hidden=true;message('Wallet account or network changed. Please reconnect.');sync();}
async function connect() {
  if(!window.ethereum)throw new Error('Open this site in MetaMask’s mobile browser, or use a desktop wallet extension.');
  const version=session;provider=new BrowserProvider(window.ethereum);await provider.send('eth_requestAccounts',[]);
  const accounts=await provider.send('eth_accounts',[]);const network=await provider.getNetwork();
  if(version!==session)return;
  $('wallet').textContent=`${accounts[0].slice(0,6)}…${accounts[0].slice(-4)}`;$('network').textContent=network.chainId===CHAIN?'Sepolia':`Chain ${network.chainId}`;
  $('switch').hidden=network.chainId===CHAIN;signer=network.chainId===CHAIN?await provider.getSigner():undefined;
  $('connect').textContent='Reconnect wallet';
  if(!signer){message('Wallet connected. Please switch to Sepolia.');return;}
  $('mobile-help').hidden=true;message('Wallet connected. Load or deploy a registry contract.','success');
}
async function load() {
  loadedAddress=undefined;clearRecord();await requireNetwork();const version=session;
  const address=getAddress($('address').value.trim());
  if(await provider.getCode(address)==='0x')throw new Error('No contract found at this address on Sepolia.');
  // Probe the expected read function before enabling writes.
  await new Contract(address,artifact.abi,provider).records('0x'+'00'.repeat(32));
  if(version!==session)return;loadedAddress=address;
  try{localStorage.setItem('fileFingerprint:sepolia',address);}catch{}
  message('Registry loaded. You can check or register a file fingerprint.','success');
}
async function deploy() {
  await requireNetwork();const version=session;message('Confirm registry deployment in your wallet.');$('transaction').hidden=true;
  const contract=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy();
  link(contract.deploymentTransaction().hash);message('Deployment sent. Waiting for confirmation…');await contract.waitForDeployment();
  if(version!==session)return;$('address').value=await contract.getAddress();await load();message('Registry deployed. Save this address to check the same records on other devices.','success');
}
async function query() {
  await requireNetwork();if(!loadedAddress)throw new Error('Load a registry contract first.');
  const fingerprint=digest(), version=session;const result=await new Contract(loadedAddress,artifact.abi,provider).records(fingerprint);
  if(version!==session)return;
  checked={registered:result.registrant!==ZeroAddress,fingerprint};
  $('record-details').hidden=!checked.registered;
  $('result').textContent=checked.registered?'Registered · Fingerprint matches':'This fingerprint is not registered in this registry';
  if(checked.registered){$('registrant').textContent=result.registrant;$('registrant').href=`https://sepolia.etherscan.io/address/${result.registrant}`;$('registered-at').textContent=new Date(Number(result.registeredAt)*1000).toLocaleString('en-GB');}
  return checked;
}
async function register() {
  await requireNetwork();const version=session,address=loadedAddress,fingerprint=digest();
  const record=await query();if(!record || version!==session)return;
  if(record.registered){message('This fingerprint is already registered. The first record cannot be overwritten.','success');return;}
  $('transaction').hidden=true;message('Confirm registration in your wallet. Only the fingerprint is recorded on-chain.');
  const tx=await new Contract(address,artifact.abi,signer).register(fingerprint);link(tx.hash);message('Registration sent. Waiting for confirmation…');
  const receipt=await tx.wait();if(!receipt || receipt.status!==1)throw new Error('The registration transaction did not succeed.');
  if(version!==session)return;await query();message('Fingerprint registered. The on-chain record is confirmed.','success');
}
$('connect').onclick=()=>run(connect);$('load').onclick=()=>run(load);$('deploy').onclick=()=>run(deploy);
$('verify').onclick=()=>run(async()=>{message('Checking the on-chain record…');await query();message('Check complete. Results apply only to this registry.','success');});
$('register').onclick=()=>run(register);
$('switch').onclick=()=>run(async()=>{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});await connect();});
$('address').oninput=()=>{loadedAddress=undefined;clearRecord();$('transaction').hidden=true;sync();};
$('fingerprint').oninput=()=>{fileVersion++;$('file').value='';$('file-info').textContent='Using a manually entered fingerprint.';clearRecord();$('transaction').hidden=true;sync();};
$('file').onchange=()=>run(async()=>{
  const version=++fileVersion;const file=$('file').files[0];$('fingerprint').value='';clearRecord();$('transaction').hidden=true;
  if(!file){$('file-info').textContent='Please select a file.';return;}
  $('file-info').textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MiB`;message('Computing the SHA-256 fingerprint on your device…');
  const hash=await hashFile(file);if(version!==fileVersion)return;$('fingerprint').value=hash;message('Fingerprint computed. File contents and filename were not uploaded.','success');
});
window.ethereum?.on?.('accountsChanged',invalidate);window.ethereum?.on?.('chainChanged',invalidate);
try{const address=new URL(location.href).searchParams.get('address') || localStorage.getItem('fileFingerprint:sepolia');if(address && isAddress(address))$('address').value=address;}catch{}
if(location.protocol==='https:')$('open-wallet').href=`https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}`;
sync();
