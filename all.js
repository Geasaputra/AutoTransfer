import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import { readFileSync } from 'fs';

// Alamat penerima default
const defaultRecipientAddress = '0xdC91FDbf1f8e5F470788CeBaC7e3B13DD63bD4bc';

// Membaca konfigurasi dari file config.json
const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf-8'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk memilih jaringan
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

  // Pilihan transaksi token atau ETH
  const transactionType = await getInput(chalk.yellow('Pilih jenis transaksi (1 untuk Token, 2 untuk ETH): '));
  if (transactionType === '1') {
    console.log(chalk.green("Anda memilih untuk melakukan transaksi Token (ERC20)."));
    await handleTokenTransaction(network); // Menangani transaksi token
  } else if (transactionType === '2') {
    console.log(chalk.green("Anda memilih untuk melakukan transaksi ETH."));
    await handleEthTransaction(network); // Menangani transaksi ETH
  } else {
    console.error(chalk.red('Jenis transaksi tidak valid'));
  }
}

// Fungsi untuk mendapatkan input dari pengguna
function getInput(question) {
  return new Promise((resolve) => {
    rl.question(chalk.yellow(question), (answer) => {
      console.log(chalk.bgRed(`Jawaban pengguna: ${answer}`));
      resolve(answer);
    });
  });
}

// Fungsi untuk menangani transaksi token (ERC20)
async function handleTokenTransaction(network) {
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  const tokenContractAddress = network.tokenContractAddress;
  const tokenAbi = [
    "function transfer(address to, uint amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint)"
  ];

  const tokenContract = new ethers.Contract(tokenContractAddress, tokenAbi, wallet);

  console.log(chalk.bgBlueBright("Pilih jenis penerima:"));
  console.log(chalk.hex('#7FFF00')("1: Alamat Target"));
  console.log(chalk.hex('#FF00FF')("2: Alamat Acak"));

  const recipientType = await getInput(chalk.yellow("Pilih (1/2) atau tekan Enter untuk default: ")) || '1';
  let recipientAddress;

  // Menentukan alamat penerima berdasarkan input
  if (recipientType === '1') {
    recipientAddress = defaultRecipientAddress;
    console.log(chalk.red("Alamat target yang digunakan:"));
  } else if (recipientType === '2') {
    recipientAddress = generateRandomAddress();
    console.log(chalk.cyan(`Alamat acak yang dihasilkan: ${recipientAddress}`));
  } else {
    console.error(chalk.red("Jenis penerima tidak valid. Menggunakan alamat default."));
    recipientAddress = defaultRecipientAddress;
  }
  console.log(chalk.hex('#ed64bd')(`Alamat yang digunakan: ${recipientAddress}`));

  const amount = ethers.parseUnits(await getInput(chalk.blue(`Masukkan jumlah token yang ingin dikirim (TOKEN): `)), network.decimals);
  const times = BigInt(await getInput(chalk.yellow('Berapa kali Anda ingin mengirim token?: ')));

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms)); // Helper untuk delay
  let successfulTransfers = 0; 

  while (successfulTransfers < Number(times)) {
    const balance = await tokenContract.balanceOf(wallet.address);

    if (balance < amount) {
      console.log(chalk.yellow('Saldo tidak mencukupi untuk transfer saat ini. Menunggu saldo mencukupi...'));
      await delay(100); 
      continue; 
    }

    let success = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const nonce = await provider.getTransactionCount(wallet.address, 'latest');
        const txResponse = await tokenContract.transfer(recipientAddress, amount, { nonce });
        const txHashUrl = `${network.explorer}tx/${txResponse.hash}`;
        console.log(chalk.bgGreen(`Token berhasil dikirim! Lihat detail transaksi di: ${txHashUrl}`));
        success = true;
        successfulTransfers++;
        break; 
      } catch (error) {
        if (error.code === 'NONCE_EXPIRED' || error.code === 'NONCE_TOO_LOW') {
          console.log(chalk.hex('#FF00FF')('Nonce kadaluarsa. Mengambil nonce terbaru dan mencoba lagi...'));
        } else {
          console.error(chalk.red('Kesalahan saat mengirim token:', error.message));
          break; 
        }
      }
    }

    if (!success) {
      console.log(chalk.red('Gagal mengirim token setelah 3 kali percobaan. Melanjutkan...'));
      await delay(100); 
    }
  }

  const updatedBalance = await tokenContract.balanceOf(wallet.address);
  console.log(chalk.bgBlue(`Sisa saldo: ${ethers.formatUnits(updatedBalance, network.decimals)} ${network.symbol}`));
}

async function handleEthTransaction(network) {
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  const times = parseInt(await getInput(chalk.blue('Berapa kali Anda ingin mengirim ETH? ')));
  const useRandomAmount = await getInput(chalk.blue('Gunakan jumlah acak? (2 untuk random, enter untuk memasukkan jumlah): '));
  const useRandom = useRandomAmount === '2';

  let fixedAmount;
  if (!useRandom) {
    fixedAmount = await getInput(chalk.blue('Masukkan jumlah yang ingin dikirim: '));
  }

  const useManualAddress = await getInput(chalk.blue('Alamat penerima? (2 untuk random, enter untuk alamat default): '));
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
      amount = generateRandomAmount(0.000001, 0.0001); 
      console.log(chalk.bgGreen(`Jumlah acak yang digunakan untuk pengiriman ke-${i + 1}: ${ethers.formatUnits(amount, 18)} ETH`));
    } else {
      amount = ethers.parseUnits(fixedAmount, 18);
    }

    await sendEthTransaction(wallet, recipientAddress, amount, provider);
  }

  rl.close();
}


async function sendEthTransaction(wallet, recipientAddress, amount, provider) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  while (true) {
    const balance = await provider.getBalance(wallet.address);

    if (balance.lt(amount)) {
      console.log(chalk.yellow('Saldo tidak mencukupi untuk transfer saat ini. Menunggu saldo mencukupi...'));
      await delay(1000); 
      continue;
    }

    try {
      const nonce = await provider.getTransactionCount(wallet.address, 'latest');
      const tx = {
        to: recipientAddress,
        value: amount,
        nonce,
        gasLimit: 21000, 
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
  return ethers.parseUnits(randomAmount.toString(), 18);
}


function generateRandomAddress() {
  return ethers.Wallet.createRandom().address; 
}


chooseNetwork();
