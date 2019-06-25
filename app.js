'use strict';

const SshClient = require('./lib/SshClient');
const Terminal = require('./lib/Terminal');

(async function() {
  const ssh = new SshClient({ applicationDir: __dirname });
  const rl = new Terminal();

  await ssh.connect();

  try {
    while (ssh.hasConnection) {
      const command = await rl.readLine();
      await ssh.executeCommand(command);
    }
  } catch(error) {
    console.log(`Runtime error: ${ JSON.stringify(error) }`);
  }

})();
