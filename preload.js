const { contextBridge } = require('electron');

const authConfig = {
  supabaseUrl: 'https://yeuojewjvyfxcxqzxnpc.supabase.co',
  anonKey: 'sb_publishable_K5uvJz80GZoBiZ6GqxpeXw__XCwKAsU',
  otpLength: 6,
  emailMaxLength: 254,
  passwordMaxLength: 72
};

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.versions.electron,
  authConfig
});
