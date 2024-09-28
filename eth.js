import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import { readFileSync } from 'fs';

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

  rl.question(chalk.yellow('Pilih jaringan (nomor jaringan): '), async (choice) => {
    const networkKey = Object.keys(config.networks)[parseInt(choice) - 1];
    if (!networkKey) {
      console.error('Jaringan tidak valid');
      rl.close();
      return;
    }

    const network = config.networks[networkKey];
    console.log(chalk.cyan(`Jaringan yang dipilih: ${network.name}`));
    
    const times = parseInt(await getInput(chalk.blue('Berapa kali Anda ingin mengirim ETH? ')));
    await handleEthTransaction(network, times); // Mengirim ETH dengan jumlah pengiriman yang ditentukan
  });
}

async function handleEthTransaction(network, times) {
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  const recipientAddress = '0x10176B0CDeb398df2C6d4A6e93bE77d5DB4170f8'; // Alamat target tetap

  const amount = ethers.parseUnits(await getInput(chalk.blue('Masukkan jumlah ETH yang ingin dikirim (dalam ETH): ')), 18);

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms)); // Helper untuk delay

  for (let i = 0; i < times; i++) {
    while (true) {
      const balance = await provider.getBalance(wallet.address);

      if (balance < amount) {
        console.log(chalk.yellow('Saldo tidak mencukupi untuk transfer saat ini. Menunggu saldo mencukupi...'));
        await delay(100); 
        continue; // Coba lagi
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
        break; // Keluar dari loop jika sukses
      } catch (error) {
        console.error(chalk.red('Kesalahan saat mengirim ETH:', error.message));
        break; // Keluar dari loop jika ada kesalahan
      }
    }

    const updatedBalance = await provider.getBalance(wallet.address);
    console.log(chalk.bgBlue(`Sisa saldo ETH setelah ${i + 1} pengiriman: ${ethers.formatUnits(updatedBalance, 18)}`));
    
    // Tunggu beberapa detik sebelum pengiriman berikutnya
    await delay(300); // Tunggu 3 detik (sesuaikan sesuai kebutuhan)
  }

  process.exit(0);
}

// Main function to start the process
chooseNetwork();
