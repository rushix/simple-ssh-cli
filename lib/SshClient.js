'use strict';

const _ = require('lodash');

const { Client } = require('ssh2');

const path = require('path');

const Terminal = require('./Terminal');

const customCommands = ['exit', 'put', 'get'];

class SshClient {
  constructor({ applicationDir }) {
    this.ssh = new Client();

    this.applicationDir = applicationDir;
  }

  clearConnectionTimeout() {
    clearTimeout(this.connectionTimeout);
  }

  refreshConnectionTimeout() {
    this.clearConnectionTimeout();
    this.connectionTimeout = setTimeout(() => {
        console.log(`Connection timeout`);

        this.hasConnection = false;

        this.ssh.end();
      }, 30000
    );
  }

  parseCustomCommand(command) {
    const commandParts = command.trim().split(' ');
    const commandPrefix = commandParts.shift();

    return customCommands.includes(commandPrefix) ? [commandPrefix, commandParts.join(' ')] : null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ssh.on('ready', () => {
        console.log('Connection is ready');

        this.refreshConnectionTimeout();

        this.hasConnection = true;

        resolve();
      });

      this.ssh.on('keyboard-interactive', async (name, instructions, lang, prompts, cb) => {
        cb([await new Terminal().readPassword(prompts.pop())]);
      });

      this.ssh.on('error', (error) => {
        console.log(`Connection error: ${ error.message }`);

        this.clearConnectionTimeout();

        reject(error);
      });

      this.ssh.connect({
        host: '192.168.1.60',
        username: 'admin',
        tryKeyboard: true,
        password: '123',
      });
    });
  }

  async executeCustomCommandExit() {
    return new Promise(resolve => {
      this.clearConnectionTimeout();

      console.log('cya');

      this.ssh.on('end', () => {
        this.hasConnection = false;

        resolve();
      });

      this.ssh.end();
    });
  }

  async executeCustomCommandGet(remotePath) {
    return new Promise((resolve, reject) => {
      this.ssh.sftp((error, stream) => {
        if (error) {
          console.log('sftp unable to be opened');

          reject(error);
        }

        const localPath = path.join(this.applicationDir, path.basename(remotePath));

        stream.fastGet(remotePath, localPath, (error) => {
          if (error) {
            console.log(`Cannot get ${ remotePath }`);

            stream.end();

            reject(error);
          }
          console.log('Download is done!');

          stream.end();

          resolve();
        });
      });
    });
  }

  async executeCustomCommandPut(localPath) {
    return new Promise((resolve, reject) => {
      this.ssh.sftp(async (error, stream) => {
        if (error) {
          console.log('sftp unable to be opened');

          reject(error);
        }

        const pwd = await this.executeRemoteCommand('pwd', false);

        const remotePath = path.join(pwd.trim(), path.basename(localPath));

        stream.fastPut(localPath, remotePath, (error) => {
          if (error) {
            console.log(`Cannot get ${ remotePath }`);

            stream.end();

            reject(error);
          }
          console.log('Upload is done!');

          stream.end();

          resolve();
        });
      });
    });
  }

  executeCommand(command) {
    const parsedCustomCommand = this.parseCustomCommand(command);

    if (!parsedCustomCommand) {
      return this.executeRemoteCommand(command);
    }

    const [customCommand, commandArguments] = parsedCustomCommand;

    return (this[`executeCustomCommand${ _.capitalize(customCommand) }`])(commandArguments);
  }

  executeRemoteCommand(command, echo = true) {
    const ptyOptions = {
      rows: process.stdout.rows,
      cols: process.stdout.cols,
      term: process.env.TERM
    };

    this.refreshConnectionTimeout();

    return new Promise((resolve, reject) => {
      this.ssh.exec(command, { pty: ptyOptions }, (error, stream) => {
        if (error) {
          console.log(`Execution error: ${ error.message }`);

          reject(error);
        }

        const output = [];

        stream.stderr.on('data', (data) => {
          console.log(`Execution error: ${ data }`);

          reject({ message: data });
        });

        stream.on('readable', () => {
          stream.pipe(process.stdout);

          process.stdin.setRawMode(true);
          process.stdin.pipe(stream);
        });

        if (!echo) {
          stream.on('data', data => {

            output.push(data);

          });
        }

        stream.on('end', () => {
          stream.unpipe(process.stdout);
          process.stdin.unpipe(stream);
          process.stdin.unref();

          resolve(output.join(''));
        });

        stream.on('close', (code, signal) => {
          stream.unpipe(process.stdout);
          process.stdin.unpipe(stream);
          process.stdin.unref();

          resolve({ code, signal });
        });
      });
    });
  }
}

module.exports = SshClient;
