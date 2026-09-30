import fs from 'node:fs';
import solc from 'solc';
const source = fs.readFileSync('contracts/FileFingerprintRegistry.sol', 'utf8');
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'FileFingerprintRegistry.sol':{content:source}},settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
const errors = (output.errors || []).filter(e => e.severity === 'error');
if(errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
const artifact = output.contracts['FileFingerprintRegistry.sol'].FileFingerprintRegistry;
fs.mkdirSync('src', {recursive:true});
fs.writeFileSync('src/contract.json', JSON.stringify({abi:artifact.abi,bytecode:'0x'+artifact.evm.bytecode.object},null,2));
console.log('Compiled FileFingerprintRegistry.');


