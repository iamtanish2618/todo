import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roomVoiceConfig} from '../lib/server/room-voice-config.mjs';
const base={enabled:true,voice:true,configured:true,iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'turn:old.example:443',username:'old',credential:'old'}]};
const secrets={TODO_TURN_URL:'turns:global.relay.metered.ca:443?transport=tcp',TODO_TURN_USERNAME:'test-user',TODO_TURN_CREDENTIAL:'test-password'};
test('guests never receive local or upstream relay credentials',()=>{
 const result=roomVoiceConfig(base,false,secrets);
 assert.equal(result.iceServers.length,1);
 assert.ok(!JSON.stringify(result).includes('credential'));
 assert.equal(base.iceServers.length,2);
});
test('verified accounts receive the configured TLS relay independently of upstream guest settings',()=>{
 const result=roomVoiceConfig({...base,iceServers:[base.iceServers[0]]},true,secrets);
 assert.deepEqual(result.iceServers[1],{urls:secrets.TODO_TURN_URL,username:'test-user',credential:'test-password'});
});
test('disabled voice and incomplete or invalid settings fail closed',()=>{
 for(const settings of [{},{...secrets,TODO_TURN_CREDENTIAL:''},{...secrets,TODO_TURN_URL:'https://attacker.example'}])
  assert.equal(roomVoiceConfig(base,true,settings).iceServers.length,1);
 assert.equal(roomVoiceConfig({...base,voice:false},true,secrets).iceServers.length,1);
});
