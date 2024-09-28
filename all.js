import readline from 'readline';
import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getInput(question) {
  return new Promise((resolve) => {
    rl.question(chalk.yellow(question), (answer) => {
      resolve(answer);
    });
  });
}

async function chooseFile() {
  const choice = await getInput('Pilih file untuk dijalankan (1: eth.js ATAU 2: erc20.js): ');

  if (choice === '1') {
    await import('./eth.js');
  } else if (choice === '2') {
    await import('./erc20.js');
  } else {
    console.log(chalk.red('Pilihan tidak valid.'));
  }
  
  rl.close(); 
}

chooseFile();
