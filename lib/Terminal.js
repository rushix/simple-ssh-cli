'use strict';

const readline = require('readline');

class Terminal {

  constructor() {
  }

  readLine() {
    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    return new Promise(resolve => {
      terminal.question('ssh cli>', answer => {
        terminal.close();

        resolve(answer);
      });
    });
  }

  readPassword({prompt, echo}) {
    console.log(prompt);

    const terminal = readline.createInterface({
      input: process.stdin,
      output: echo ? process.stdout : undefined,
      terminal: true,
    });

    return new Promise(resolve => {
      terminal.question('', answer => {
        terminal.close();

        resolve(answer);
      });
    });
  }
}

module.exports = Terminal;
