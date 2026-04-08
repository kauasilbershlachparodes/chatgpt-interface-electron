const { contextBridge } = require('electron');

const authConfig = {
  supabaseUrl: 'https://xkkrbnxqtrfjzbasvocz.supabase.co',
  anonKey: 'sb_publishable_MhEwBmkNjTFAMSZniI5XzQ_45tNsIYX',
  otpLength: 8,
  emailMaxLength: 254,
  passwordMaxLength: 72
};

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.versions.electron,
  authConfig
});
