import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, ZeroAddress } from 'ethers';
import { hashFile, normalizeFingerprint, MAX_FILE_SIZE } from '../src/fingerprint.js';
test('SHA-256 known vector, same bytes regardless of filename, different bytes, and empty files',async()=>{
  const file=new Blob(['abc']);
  const hash=await hashFile(file);
  assert.equal(hash,'0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await hashFile(new File(['abc'],'renamed.pdf')),hash);
  assert.notEqual(await hashFile(new Blob(['abd'])),hash);
  assert.equal(await hashFile(new Blob([])),'0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(normalizeFingerprint(hash.slice(2).toUpperCase()),hash);
  for(const value of ['abc','0x'+'00'.repeat(32),'z'.repeat(64)])assert.throws(()=>normalizeFingerprint(value));
  await assert.rejects(hashFile({size:MAX_FILE_SIZE+1}),/50 MiB/);
});
test('registration preserves first wallet and timestamp, emits event, rejects duplicates and zero',async()=>{
  const rpc=ganache.provider({logging:{quiet:true}});
  try{
    const provider=new BrowserProvider(rpc),signer=await provider.getSigner();
    const artifact=JSON.parse(fs.readFileSync('src/contract.json','utf8'));
    const contract=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy();await contract.waitForDeployment();
    const hash=await hashFile(new Blob(['abc']));
    assert.equal((await contract.records(hash)).registrant,ZeroAddress);
    const receipt=await (await contract.register(hash)).wait();
    const record=await contract.records(hash);
    assert.equal(record.registrant,await signer.getAddress());assert(record.registeredAt>0n);
    assert.equal(contract.interface.parseLog(receipt.logs[0]).args.fingerprint,hash);
    await assert.rejects(contract.connect(await provider.getSigner(1)).register(hash));
    assert.equal((await contract.records(hash)).registrant,record.registrant);
    assert.equal((await contract.records(hash)).registeredAt,record.registeredAt);
    await assert.rejects(contract.register('0x'+'00'.repeat(32)));
    const other=await hashFile(new Blob(['changed']));
    assert.equal((await contract.records(other)).registrant,ZeroAddress);
  }finally{await rpc.disconnect();}
});
