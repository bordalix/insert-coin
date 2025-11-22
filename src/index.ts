import encodeQR from "qr";
import { hex } from "@scure/base";
import {
    ArkAddress,
    SingleKey,
    Wallet,
    type NetworkName,
} from "@arkade-os/sdk";
import {
    ArkadeLightning,
    BoltzSwapProvider,
    type CreateLightningInvoiceResponse,
} from "@arkade-os/boltz-swap";

/**
 * Get server info from server url
 * We need server's pubkey and network to initialize wallet
 *
 * @param arkServerUrl
 * @throws Error if fetch fails
 * @returns object with signerPubkey and network
 */
export async function getServerInfo(
    arkServerUrl: string
): Promise<{ signerPubkey: string; network: NetworkName }> {
    const res = await fetch(`${arkServerUrl}/v1/info`);
    if (!res.ok)
        throw new Error(`Failed to fetch server info: ${res.statusText}`);
    const serverInfo = (await res.json()) as {
        signerPubkey: string;
        network: NetworkName;
    };
    return serverInfo;
}

/**
 * Validate that the ark address belongs to the server's pubkey
 * Throws error if invalid
 *
 * @param signerPubkey
 * @param arkAddress
 * @throws Error if address is invalid or doesn't belong to server pubkey
 */
export function verifyArkAddress(signerPubkey: string, arkAddress = ""): void {
    const { serverPubKey } = ArkAddress.decode(arkAddress); // throws if invalid
    const belongs = signerPubkey.includes(hex.encode(serverPubKey));
    if (!belongs)
        throw new Error("Ark address doesn't belong to server's pubkey");
}

export interface InsertCoinOptions {
    network: NetworkName;
    arkAddress: string;
    boltzApiUrl: string;
    arkServerUrl: string;
    privateKey: string;
    signerPubkey: string;
    swapProvider: BoltzSwapProvider;
}

export class InsertCoin {
    readonly network: NetworkName;
    readonly arkAddress: string;
    readonly boltzApiUrl: string;
    readonly arkServerUrl: string;
    readonly privateKey: string;
    readonly signerPubkey: string;
    readonly swapProvider: BoltzSwapProvider;

    private constructor(options: InsertCoinOptions) {
        this.network = options.network;
        this.arkAddress = options.arkAddress;
        this.boltzApiUrl = options.boltzApiUrl;
        this.arkServerUrl = options.arkServerUrl;
        this.privateKey = options.privateKey;
        this.signerPubkey = options.signerPubkey;
        this.swapProvider = options.swapProvider;
    }

    /**
     * Create InsertCoin instance
     * - get server info
     * - validate ark address
     * - initialize swap provider
     *
     * @example
     * const insertCoin = await InsertCoin.create({
     *   arkAddress: 'ark1...', // where to send received coins
     *   boltzApiUrl: 'https://boltz.api',
     *   arkServerUrl: 'https://ark.server',
     *   privateKey: 'your-private-key' // optional
     * })
     *
     * @param options with arkAddress, boltzApiUrl, arkServerUrl, privateKey
     * @throws Error if required options are missing or invalid
     * @returns a InsertCoin instance
     */
    static async create(options: {
        arkAddress: string;
        boltzApiUrl: string;
        arkServerUrl: string;
        privateKey?: string;
    }): Promise<InsertCoin> {
        // destructure options and validate
        const privateKey = options.privateKey || "";
        const { arkServerUrl, arkAddress, boltzApiUrl } = options;
        if (!arkAddress) throw new Error("Ark address is required");
        if (!boltzApiUrl) throw new Error("Boltz API URL is required");
        if (!arkServerUrl) throw new Error("Ark server URL is required");

        // fetch server info
        const { network, signerPubkey } = await getServerInfo(arkServerUrl);
        if (!network) throw new Error("Failed to get network from server");
        if (!signerPubkey) throw new Error("Failed to get signer pubkey");

        // validate ark address if provided
        verifyArkAddress(signerPubkey, arkAddress); // throws if invalid

        // initialize the Lightning swap provider
        const swapProvider = new BoltzSwapProvider({
            apiUrl: boltzApiUrl,
            network,
        });

        // return InsertCoin instance
        return new InsertCoin({
            arkAddress,
            arkServerUrl,
            boltzApiUrl,
            network,
            privateKey,
            signerPubkey,
            swapProvider,
        });
    }

    /**
     * Request a lightning invoice for the specified amount
     * - create ephemeral identity if no private key provided
     * - create wallet
     * - create ArkadeLightning instance
     * - create lightning invoice
     * - generate QR code HTML
     *
     * @example
     * const invoiceData = await insertCoin.requestInvoice({ amountSats: 1000 })
     *
     * @param options with amountSats specifying the amount in satoshis
     * @throws Error if amountSats is invalid or invoice creation fails
     * @returns object containing invoice details and related instances
     */
    async requestInvoice(options: { amountSats: number }): Promise<{
        amount: number;
        arkadeLightning: ArkadeLightning;
        expiry: number;
        identity: SingleKey;
        invoice: string;
        preimage: string;
        pendingSwap: CreateLightningInvoiceResponse["pendingSwap"];
        qrCodeHtml: string;
        wallet: Wallet;
    }> {
        const { amountSats } = options;
        if (!amountSats || amountSats <= 0)
            throw new Error("Amount must be greater than zero");

        const identity = this.privateKey
            ? SingleKey.fromHex(this.privateKey)
            : SingleKey.fromRandomBytes();

        // create wallet with ephemeral identity
        const wallet = await Wallet.create({
            arkServerUrl: this.arkServerUrl,
            identity,
        });

        // create the ArkadeLightning instance
        const arkadeLightning = new ArkadeLightning({
            swapProvider: this.swapProvider,
            wallet,
        });

        // create lightning invoice
        const result = await arkadeLightning.createLightningInvoice({
            description: "Insert Coin",
            amount: amountSats,
        });

        // validate result
        const { expiry, invoice, pendingSwap, preimage, amount } = result;
        if (!expiry) throw new Error("Invalid expiry in result");
        if (!invoice) throw new Error("Invalid invoice in result");
        if (!preimage) throw new Error("Invalid preimage in result");
        if (!pendingSwap) throw new Error("Invalid pendingSwap in result");
        if (amount > amountSats) throw new Error("Invalid amount in result");

        // generate QR code HTML
        const gifBytes = new Uint8Array(encodeQR(invoice, "gif", { scale: 7 }));
        const blob = new Blob([gifBytes], { type: "image/gif" });
        const qrCodeHtml = `<img src=${URL.createObjectURL(blob)} alt='QR Code' />`;

        return {
            amount,
            arkadeLightning,
            expiry,
            identity,
            invoice,
            pendingSwap,
            preimage,
            qrCodeHtml,
            wallet,
        };
    }

    /**
     * Request a coin by creating a lightning invoice and handling payment
     *
     * @example
     * insertCoin.requestCoin({
     *   amountSats: 1000,
     *   onInvoice: ({ amount, expiry, invoice, preimage, qrCodeHtml }) => {
     *     // display invoice and QR code to user
     *   },
     *   onPayment: ({ txid }) => {
     *     // handle successful payment
     *   }
     * })
     *
     * @param options with amountSats, onInvoice callback, onPayment callback
     * @throws Error if required options are missing or invalid
     * @returns void
     */
    async requestPayment(options: {
        amountSats: number;
        onInvoice: (data: {
            amount: number;
            expiry: number;
            invoice: string;
            preimage: string;
            qrCodeHtml: string;
        }) => void;
        onPayment: (data: { txid: string }) => void;
    }): Promise<void> {
        // destructure and validate options
        const { amountSats, onInvoice, onPayment } = options;
        if (!amountSats) throw new Error("Amount must be defined");
        if (!onInvoice) throw new Error("onInvoice callback is required");
        if (!onPayment) throw new Error("onPayment callback is required");
        if (amountSats <= 0)
            throw new Error("Amount must be greater than zero");

        // request invoice
        const invoiceResult = await this.requestInvoice({ amountSats });
        const {
            amount,
            arkadeLightning,
            expiry,
            invoice,
            preimage,
            qrCodeHtml,
            wallet,
            pendingSwap,
        } = invoiceResult;

        // call onInvoice callback
        onInvoice({ amount, expiry, invoice, preimage, qrCodeHtml });

        // wait for payment
        const { txid } = await this.waitForPayment({
            arkadeLightning,
            pendingSwap,
            wallet,
        });

        // call onPayment callback with txid
        onPayment({ txid });
    }

    /**
     * wait for payment and claim the swap
     *
     * @example
     * const {
     *   wallet
     *   pendingSwap,
     *   arkadeLightning,
     * } = await insertCoin.requestInvoice({ amountSats: 1000 })
     *
     * const { txid } = await insertCoin.waitForPayment({
     *   arkadeLightning,
     *   pendingSwap,
     *   wallet
     * })
     *
     * @param options arkadeLightning, pendingSwap, wallet
     * @throws Error if required options are missing or invalid
     * @returns txid of the received coin
     */
    async waitForPayment(options: {
        arkadeLightning: ArkadeLightning;
        pendingSwap: CreateLightningInvoiceResponse["pendingSwap"];
        wallet: Wallet;
    }): Promise<{ txid: string }> {
        // destructure and validate options
        const { arkadeLightning, wallet, pendingSwap } = options;
        if (!arkadeLightning) throw new Error("arkadeLightning is required");
        if (!pendingSwap) throw new Error("pendingSwap is required");
        if (!wallet) throw new Error("wallet is required");

        // wait and claim the swap
        const result = await arkadeLightning.waitAndClaim(pendingSwap);
        if (!result.txid) throw new Error("Failed to receive coin");

        // send all received bitcoin to the ark address
        const balance = await wallet.getBalance();
        await wallet.sendBitcoin({
            address: this.arkAddress,
            amount: balance.available,
        });

        // return txid
        return { txid: result.txid };
    }
}
