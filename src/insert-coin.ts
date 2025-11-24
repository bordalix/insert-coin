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
    PendingReverseSwap,
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
 * @returns void
 */
export function verifyArkAddress(signerPubkey: string, arkAddress = ""): void {
    const { serverPubKey } = ArkAddress.decode(arkAddress); // throws if invalid
    const belongs = signerPubkey.includes(hex.encode(serverPubKey));
    if (!belongs)
        throw new Error("Ark address doesn't belong to server's pubkey");
}

export class InsertCoin {
    readonly arkadeLightning: ArkadeLightning;
    readonly arkAddress: string;
    readonly arkServerUrl: string;
    readonly boltzApiUrl: string;
    readonly network: NetworkName;
    readonly privateKey: string;
    readonly signerPubkey: string;
    readonly wallet: Wallet;

    private constructor(options: {
        arkadeLightning: ArkadeLightning;
        arkAddress: string;
        arkServerUrl: string;
        boltzApiUrl: string;
        network: NetworkName;
        privateKey: string;
        signerPubkey: string;
        wallet: Wallet;
    }) {
        this.arkadeLightning = options.arkadeLightning;
        this.arkAddress = options.arkAddress;
        this.arkServerUrl = options.arkServerUrl;
        this.boltzApiUrl = options.boltzApiUrl;
        this.network = options.network;
        this.privateKey = options.privateKey;
        this.signerPubkey = options.signerPubkey;
        this.wallet = options.wallet;
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
     *   arkServerUrl: 'https://arkade.computer',
     *   boltzApiUrl: 'https://api.ark.boltz.exchange',
     *   privateKey: 'your-private-key', // optional
     *   referralId: 'your-referral-id', // optional
     * })
     *
     * @param options with arkAddress, boltzApiUrl, arkServerUrl, privateKey
     * @throws Error if required options are missing or invalid
     * @returns a InsertCoin instance
     */
    static async create(options: {
        arkAddress: string;
        arkServerUrl: string;
        boltzApiUrl: string;
        privateKey?: string;
        referralId?: string;
    }): Promise<InsertCoin> {
        // destructure options and validate
        const privateKey = options.privateKey || "";
        const { arkServerUrl, arkAddress, boltzApiUrl, referralId } = options;
        if (!arkServerUrl) throw new Error("Ark server URL is required");
        if (!boltzApiUrl) throw new Error("Boltz API URL is required");
        if (!arkAddress) throw new Error("Ark address is required");

        // fetch server info
        const { network, signerPubkey } = await getServerInfo(arkServerUrl);
        if (!network) throw new Error("Failed to get network from server");
        if (!signerPubkey) throw new Error("Failed to get signer pubkey");

        // validate ark address if provided
        verifyArkAddress(signerPubkey, arkAddress); // throws if invalid

        // initialize the Lightning swap provider
        const swapProvider = new BoltzSwapProvider({
            apiUrl: boltzApiUrl,
            referralId,
            network,
        });

        // create identity from private key or generate ephemeral one
        const identity = privateKey
            ? SingleKey.fromHex(privateKey)
            : SingleKey.fromRandomBytes();

        // create wallet with identity
        const wallet = await Wallet.create({
            arkServerUrl,
            identity,
        });

        // create the ArkadeLightning instance
        const arkadeLightning = new ArkadeLightning({
            swapProvider: swapProvider,
            wallet,
        });

        // return InsertCoin instance
        return new InsertCoin({
            arkadeLightning,
            arkAddress,
            arkServerUrl,
            boltzApiUrl,
            network,
            privateKey,
            signerPubkey,
            wallet,
        });
    }

    /**
     * Request a lightning invoice for the specified amount
     * - create ephemeral identity if no private key provided
     * - create Arkade Wallet instance with identity
     * - create ArkadeLightning instance
     * - create lightning invoice
     * - generate QR code HTML (<img src="data:image/gif;base64,..." />)
     *
     * @example
     * const invoiceData = await insertCoin.requestInvoice({
     *   amountSats: 500,
     *   description: "Insert coin", // optional
     * })
     *
     * @param options with amountSats specifying the amount in satoshis
     * @throws Error if amountSats is invalid or invoice creation fails
     * @returns object containing invoice details and related instances
     */
    async requestInvoice(options: {
        amountSats: number;
        description?: string;
    }): Promise<{
        amount: number;
        expiry: number;
        invoice: string;
        preimage: string;
        pendingSwap: PendingReverseSwap;
        qrImage: string;
    }> {
        // destructure and validate options
        const { amountSats } = options;
        if (!amountSats || amountSats <= 0)
            throw new Error("Amount must be greater than zero");
        const description = options.description ?? "Insert Coin";

        // create lightning invoice
        const result = await this.arkadeLightning.createLightningInvoice({
            amount: amountSats,
            description,
        });

        // validate result
        const { amount, expiry, invoice, pendingSwap, preimage } = result;
        if (!expiry) throw new Error("Invalid expiry in result");
        if (!invoice) throw new Error("Invalid invoice in result");
        if (!preimage) throw new Error("Invalid preimage in result");
        if (!pendingSwap) throw new Error("Invalid pendingSwap in result");
        if (amount > amountSats) throw new Error("Invalid amount in result");

        // generate QR code HTML (<img src="data:image/gif;base64,..." />)
        const gifBytes = new Uint8Array(encodeQR(invoice, "gif", { scale: 7 }));
        const blob = new Blob([gifBytes], { type: "image/gif" });
        const qrImage = `<img src=${URL.createObjectURL(blob)} alt='QR Code' />`;

        return {
            amount,
            expiry,
            invoice,
            preimage,
            pendingSwap,
            qrImage,
        };
    }

    /**
     * Request a coin by creating a lightning invoice and handling payment
     *
     * @example
     * insertCoin.requestCoin({
     *   amountSats: 1000,
     *   onInvoice: ({ amount, expiry, invoice, preimage, qrImage }) => {
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
        description?: string;
        onInvoice: (data: {
            amount: number;
            expiry: number;
            invoice: string;
            preimage: string;
            qrImage: string;
        }) => void;
        onPayment: (data: { txid: string }) => void;
    }): Promise<void> {
        // destructure and validate options
        const { amountSats, description, onInvoice, onPayment } = options;
        if (!amountSats) throw new Error("Amount must be defined");
        if (!onInvoice) throw new Error("onInvoice callback is required");
        if (!onPayment) throw new Error("onPayment callback is required");
        if (amountSats <= 0)
            throw new Error("Amount must be greater than zero");

        // request invoice
        const { amount, expiry, invoice, pendingSwap, preimage, qrImage } =
            await this.requestInvoice({ amountSats, description });

        // call onInvoice callback
        onInvoice({ amount, expiry, invoice, preimage, qrImage });

        // wait for payment
        const { txid } = await this.waitForPayment({ pendingSwap });

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
        pendingSwap: PendingReverseSwap;
    }): Promise<{ txid: string }> {
        // destructure and validate options
        const { pendingSwap } = options;
        if (!pendingSwap) throw new Error("pendingSwap is required");

        // wait and claim the swap
        const result = await this.arkadeLightning.waitAndClaim(pendingSwap);
        if (!result.txid) throw new Error("Failed to receive coin");

        // send all received bitcoin to the ark address
        const { available } = await this.wallet.getBalance();
        if (!available) throw new Error("No balance available to send");
        await this.wallet.sendBitcoin({
            address: this.arkAddress,
            amount: available,
        });

        // return txid
        return { txid: result.txid };
    }
}
