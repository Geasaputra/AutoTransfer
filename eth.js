import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import { readFileSync } from 'fs';


const defaultRecipientAddress = '0xdC91FDbf1f8e5F470788CeBaC7e3B13DD63bD4bc'; 

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf-8'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getInput(question) {
  return new Promise((resolve) => {
    rl.question(chalk.yellow(question), (answer) => {
      console.log(chalk.bgRed(`Jawaban pengguna: ${answer}`));
      resolve(answer);
    });
  });
}

async function chooseNetwork() {
  console.log(chalk.yellow("Jaringan tersedia:"));
  Object.keys(config.networks).forEach((key, index) => {
    console.log(chalk.yellow(`${index + 1}. ${config.networks[key].name}`));
  });

  const choice = await getInput(chalk.yellow('Pilih jaringan (nomor jaringan): '));
  const networkKey = Object.keys(config.networks)[parseInt(choice) - 1];
  if (!networkKey) {
    console.error(chalk.red('Jaringan tidak valid'));
    rl.close();
    return;
  }

  const network = config.networks[networkKey];
  console.log(chalk.cyan(`Jaringan yang dipilih: ${network.name}`));

  const times = parseInt(await getInput(chalk.blue('Berapa kali Anda ingin mengirim ETH? ')));

  const useRandomAmount = await getInput(chalk.blue('Gunakan jumlah acak? (2 untuk random, enter untuk memasukkan jumlah): '));
  const useRandom = useRandomAmount === '2'; 

  let fixedAmount;
  if (!useRandom) {
    fixedAmount = await getInput(chalk.blue('Masukkan jumlah yang ingin dikirim: '));
  }


  const useManualAddress = await getInput(chalk.blue('addreess penerima? (2 untuk random, enter untuk alamat default): '));
  let recipientAddress;

  
  if (useManualAddress === '2') {
    recipientAddress = generateRandomAddress();
    console.log(chalk.yellow(`Alamat random digunakan: ${recipientAddress}`));
  } else {
    
    recipientAddress = useManualAddress || defaultRecipientAddress; 
    console.log(chalk.bgGreen(`Alamat yang digunakan untuk pengiriman: ${recipientAddress}`));
  }

  for (let i = 0; i < times; i++) {
    let amount;
    if (useRandom) {
      amount = generateRandomAmount(0.000001, 0.0001); // Menghasilkan jumlah acak
      console.log(chalk.bgGreen(`Jumlah acak yang digunakan untuk pengiriman ke-${i + 1}: ${ethers.formatUnits(amount, 18)} ETH`));
    } else {
      amount = ethers.parseUnits(fixedAmount, 18); 
    }

    await handleEthTransaction(network, recipientAddress, amount); 
  }

  rl.close();
}

async function handleEthTransaction(network, recipientAddress, amount) {
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  while (true) {
    const balance = await provider.getBalance(wallet.address);

    if (balance < amount) {
      console.log(chalk.yellow('Saldo tidak mencukupi untuk transfer saat ini. Menunggu saldo mencukupi...'));
      await delay(100);
      continue;
    }

    try {
      const nonce = await provider.getTransactionCount(wallet.address, 'latest');
      const tx = {
        to: recipientAddress,
        value: amount,
        nonce
      };
      const txResponse = await wallet.sendTransaction(tx);
      const txHashUrl = `${network.explorer}tx/${txResponse.hash}`;
      console.log(chalk.bgGreen(`ETH berhasil dikirim! Lihat detail transaksi di: ${txHashUrl}`));
      break;
    } catch (error) {
      console.error(chalk.red('Kesalahan saat mengirim ETH:', error.message));
      break;
    }
  }

  const updatedBalance = await provider.getBalance(wallet.address);
  console.log(chalk.bgBlue(`Sisa saldo ETH setelah pengiriman: ${ethers.formatUnits(updatedBalance, 18)}`));
}

function generateRandomAmount(min, max) {
  const randomAmount = Math.random() * (max - min) + min;
  return ethers.parseUnits(randomAmount.toFixed(18), 18);
}

function generateRandomAddress() {
  return ethers.Wallet.createRandom().address; 
}


chooseNetwork();
