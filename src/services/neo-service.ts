import { rpc, wallet, sc, u } from '@cityofzion/neon-js';

/**
 * Service for interacting with the Neo N3 blockchain
 */
export class NeoService {
  private rpcClient: rpc.RPCClient;

  /**
   * Create a new Neo service
   * @param rpcUrl URL of the Neo N3 RPC node
   */
  constructor(rpcUrl: string) {
    this.rpcClient = new rpc.RPCClient(rpcUrl);
  }

  /**
   * Get general blockchain information
   * @returns Object containing blockchain height and validators
   */
  async getBlockchainInfo() {
    const height = await this.rpcClient.getBlockCount();
    const validators = await this.rpcClient.getValidators();
    return { height, validators };
  }

  /**
   * Get block details by height or hash
   * @param hashOrHeight Block height or hash
   * @returns Block details
   */
  async getBlock(hashOrHeight: string | number) {
    return await this.rpcClient.getBlock(hashOrHeight, 1);
  }

  /**
   * Get transaction details by hash
   * @param txid Transaction hash
   * @returns Transaction details
   */
  async getTransaction(txid: string) {
    return await this.rpcClient.getTransaction(txid);
  }

  /**
   * Get account balance for a specific address
   * @param address Neo N3 address
   * @returns Balance information
   */
  async getBalance(address: string) {
    return await this.rpcClient.getBalance(address);
  }

  /**
   * Transfer assets between addresses
   * @param fromAccount Sender account
   * @param toAddress Recipient address
   * @param asset Asset hash or symbol (e.g., 'NEO', 'GAS')
   * @param amount Amount to transfer
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction details
   */
  async transferAssets(
    fromAccount: wallet.Account,
    toAddress: string,
    asset: string,
    amount: string | number,
    additionalScriptAttributes: sc.ScriptAttribute[] = []
  ) {
    // Create a transaction
    const script = sc.createScript({
      scriptHash: asset.startsWith('0x') ? asset : this.getAssetHash(asset),
      operation: 'transfer',
      args: [
        sc.ContractParam.hash160(fromAccount.address),
        sc.ContractParam.hash160(toAddress),
        sc.ContractParam.integer(amount),
        sc.ContractParam.any(null),
      ],
    });

    // Create transaction intent
    const txIntent = {
      script,
      attributes: additionalScriptAttributes,
      signers: [
        {
          account: u.HexString.fromHex(wallet.getScriptHashFromAddress(fromAccount.address)),
          scopes: 'CalledByEntry',
        },
      ],
    };

    // Sign and send transaction
    const tx = await this.rpcClient.invokeScript(
      u.HexString.fromHex(script),
      txIntent.signers
    );

    // Add witness
    const signedTx = await wallet.signTransaction(tx, fromAccount);

    // Send transaction
    const result = await this.rpcClient.sendRawTransaction(signedTx);

    return { txid: result, tx: signedTx };
  }

  /**
   * Invoke a smart contract method
   * @param fromAccount Account to sign the transaction
   * @param scriptHash Contract script hash
   * @param operation Method name
   * @param args Method arguments
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction details
   */
  async invokeContract(
    fromAccount: wallet.Account,
    scriptHash: string,
    operation: string,
    args: sc.ContractParam[] = [],
    additionalScriptAttributes: sc.ScriptAttribute[] = []
  ) {
    // Create a transaction
    const script = sc.createScript({
      scriptHash,
      operation,
      args,
    });

    // Create transaction intent
    const txIntent = {
      script,
      attributes: additionalScriptAttributes,
      signers: [
        {
          account: u.HexString.fromHex(wallet.getScriptHashFromAddress(fromAccount.address)),
          scopes: 'CalledByEntry',
        },
      ],
    };

    // Sign and send transaction
    const tx = await this.rpcClient.invokeScript(
      u.HexString.fromHex(script),
      txIntent.signers
    );

    // Add witness
    const signedTx = await wallet.signTransaction(tx, fromAccount);

    // Send transaction
    const result = await this.rpcClient.sendRawTransaction(signedTx);

    return { txid: result, tx: signedTx };
  }

  /**
   * Create a new wallet
   * @param password Password for encrypting the wallet
   * @returns New wallet account
   */
  createWallet(password: string) {
    const account = new wallet.Account();
    return {
      address: account.address,
      publicKey: account.publicKey,
      encryptedPrivateKey: account.encrypt(password),
      WIF: account.WIF,
    };
  }

  /**
   * Import a wallet from WIF or encrypted key
   * @param key WIF or encrypted private key
   * @param password Password for decrypting the key (if encrypted)
   * @returns Wallet account
   */
  importWallet(key: string, password?: string) {
    let account: wallet.Account;

    if (password) {
      // Import from encrypted key
      account = new wallet.Account();
      account.decrypt(key, password);
    } else {
      // Import from WIF
      account = new wallet.Account(key);
    }

    return {
      address: account.address,
      publicKey: account.publicKey,
    };
  }

  /**
   * Get asset hash from symbol
   * @param symbol Asset symbol (e.g., 'NEO', 'GAS')
   * @returns Asset hash
   */
  private getAssetHash(symbol: string): string {
    // These are the mainnet asset hashes
    const assets: Record<string, string> = {
      NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
    };

    if (!assets[symbol.toUpperCase()]) {
      throw new Error(`Unknown asset: ${symbol}`);
    }

    return assets[symbol.toUpperCase()];
  }
}
