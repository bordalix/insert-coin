# Insert coin

A client-side paywall powered by Arkade

## How it works

- Creates an ephemeral wallet
- Creates a reverse submarine swap
- Returns qr code image and invoice
- On payment, send sats to final recipient

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
    arkAddress, // "ark1..." the final recipient for the sats
    arkServerUrl, // optional, defaults to https://arkade.computer
    boltzApiUrl, // optional, defaults to https://api.ark.boltz.exchange
    privateKey, // optional, uses ephemeral keys if no private key is provided
});
```

### Using callbacks

```typescript
// example function to show the returned info to the user
function showQrCode(data: { invoice: string; qrCodeHtml: string }) {
    document.querySelector<HTMLDivElement>("#qrCode")!.innerHtml = `
    <p>${data.qrCodeHtml}</p>
    <p>${data.invoice}</p>
  `;
}

// example function to unlock the paid content
function unlockContent() {
    document.querySelector<HTMLDivElement>("#qrCode")!.style.display = "none";
    document.querySelector<HTMLDivElement>("#content")!.style.display = "block";
}

// request payment
provider.requestPayment({
    amountSats,
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
} = await provider.requestInvoice({ amountSats });

// show qrcode and invoice to user
showQrCode(invoiceData);

// wait for payment
const paymentData: { txid: string } = await provider.waitForPayment(
    invoiceData.pendingSwap
);

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

```bash
git clone https://github.com/bordalix/insert-coin
cd insert-coin
pnpm install
pnpm lint
pnpm build
```
