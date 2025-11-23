import {
    InsertCoin,
    getServerInfo,
    verifyArkAddress,
} from "../src/insert-coin.ts";
import fixtures from "./fixtures.json";
import { describe, it, expect, vi } from "vitest";

describe("getServerInfo", () => {
    it("should fetch server info successfully", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: "mockPubkey",
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        const result = await getServerInfo(fixtures.mockUrl);
        expect(result).toEqual({
            signerPubkey: "mockPubkey",
            network: "mockNetwork",
        });
    });

    it("should throw an error if fetch fails", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                statusText: "Not Found",
            })
        ) as unknown as typeof fetch;

        await expect(getServerInfo(fixtures.mockUrl)).rejects.toThrow(
            "Failed to fetch server info: Not Found"
        );
    });
});

describe("verifyArkAddress", () => {
    it("should not throw for a valid address belonging to the server", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockServerPubkey.valid,
                fixtures.mockArkAddress.valid
            )
        ).not.toThrow();
    });

    it("should throw an error if address is invalid", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockServerPubkey.valid,
                fixtures.mockArkAddress.invalid
            )
        ).toThrow("Invalid address");
    });

    it("should throw an error if address doesn't belong to the server", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockServerPubkey.invalid,
                fixtures.mockArkAddress.valid
            )
        ).toThrow("Ark address doesn't belong to server's pubkey");
    });
});

describe("Creating InsertCoin instance", () => {
    it("should fetch server info and verify address successfully", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: fixtures.mockServerPubkey.valid,
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        expect(() =>
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).not.toThrow();
    });

    it("should throw on invalid signer pubkey", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: fixtures.mockServerPubkey.invalid,
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        // expect InsertCoin.create to throw
        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).rejects.toThrow("Ark address doesn't belong to server's pubkey");
    });

    it("should throw on absent ark address", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: fixtures.mockServerPubkey.invalid,
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        // expect InsertCoin.create to throw
        await expect(
            InsertCoin.create({
                arkAddress: "",
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).rejects.toThrow("Ark address is required");
    });

    it("should throw on absent ark server url", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: fixtures.mockServerPubkey.invalid,
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: "",
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).rejects.toThrow("Ark server URL is required");
    });

    it("should throw on absent boltz api url", async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signerPubkey: fixtures.mockServerPubkey.invalid,
                        network: "mockNetwork",
                    }),
            })
        ) as unknown as typeof fetch;

        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: "",
            })
        ).rejects.toThrow("Boltz API URL is required");
    });
});
