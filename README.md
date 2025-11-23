# Insert coin

A client-side paywall powered by Arkade

## How it works

### Flow

- Creates an ephemeral wallet
- Creates a reverse submarine swap
- Returns qr code image tag and invoice
- After payment, send sats to final recipient

### Demo

See it working at https://arkade-invaders.pages.dev

## How to use it

### Install

```bash
pnpm install insert-coin
```

### Create provider

Create an InsertCoin provider for the given servers and ark address as final recipient

```typescript
// create InsertCoin provider
const provider = await InsertCoin.create({
    arkAddress: "ark1...", // the final recipient for the funds
    arkServerUrl: "https://arkade.computer",
    boltzApiUrl: "https://api.ark.boltz.exchange",
    privateKey, // optional, uses ephemeral keys if no private key is provided
    referralId, // optional, referral id to be used in Boltz swaps
});
```

### Using callbacks

```typescript
// example function to show the returned info to the user
// note: qrCodeHtml = <img src="data:image/gif;base64,..." />
function showQrCode(data: { invoice: string; qrCodeHtml: string }) {
    document.querySelector<HTMLDivElement>("#paywall")!.innerHtml = `
    <p>${data.qrCodeHtml}</p>
    <p>${data.invoice}</p>
  `;
}

// example function to unlock the paid content
function unlockContent() {
    document.querySelector<HTMLDivElement>("#paywall")!.style.display = "none";
    document.querySelector<HTMLDivElement>("#content")!.style.display = "block";
}

// request payment
provider.requestPayment({
    amountSats: 500,
    description: "Insert coin", // optional
    onInvoice: showQrCode,
    onPayment: unlockContent,
});
```

### Using async/await

```typescript
// get invoice data
const invoiceData: {
    amount: number;
    arkadeLightning: ArkadeLightning;
    expiry: number;
    identity: SingleKey;
    invoice: string;
    preimage: string;
    pendingSwap: CreateLightningInvoiceResponse["pendingSwap"];
    qrCodeHtml: string;
    wallet: Wallet;
} = await provider.requestInvoice({
  amountSats: 500,
  description: "Insert coin", // optional
});

// show qrcode and invoice to user
showQrCode(invoiceData);

// wait for payment
const paymentData: { txid: string } = await provider.waitForPayment({
    arkadeLightning: invoiceData.arkadeLightning
    pendingSwap: invoiceData.pendingSwap,
    wallet: invoiceData.wallet
});

// unlock paid content
unlockPayment();
```

## Stack

### Dependencies

- @arkade-os/boltz-swap
- @arkade-os/sdk
- qr

### Dev dependencies

- typescript
- prettier
- tsup
- vite

## Development

To build it locally:

```bash
git clone https://github.com/bordalix/insert-coin
cd insert-coin
pnpm install
pnpm build
```

Other useful commands:

```bash
pnpm lint
pnpm test
pnpm format
```
