import {
    InsertCoin,
    getServerInfo,
    verifyArkAddress,
} from "../src/insert-coin.ts";
import fixtures from "./fixtures.json";
import { describe, it, expect, vi, beforeAll } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("getServerInfo", () => {
    it("should fetch server info successfully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    signerPubkey: fixtures.mockArkInfo.signerPubkey,
                    network: fixtures.mockArkInfo.network,
                }),
        });

        const result = await getServerInfo(fixtures.mockUrl);

        expect(result).toEqual({
            signerPubkey: fixtures.mockArkInfo.signerPubkey,
            network: fixtures.mockArkInfo.network,
        });
    });

    it("should throw an error if fetch fails", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            statusText: "Not Found",
        });

        await expect(getServerInfo(fixtures.mockUrl)).rejects.toThrow(
            "Failed to fetch server info: Not Found"
        );
    });
});

describe("verifyArkAddress", () => {
    it("should not throw for a valid address belonging to the server", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockArkInfo.signerPubkey,
                fixtures.mockArkAddress.valid
            )
        ).not.toThrow();
    });

    it("should throw an error if address is invalid", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockArkInfo.signerPubkey,
                fixtures.mockArkAddress.invalid
            )
        ).toThrow("Invalid address");
    });

    it("should throw an error if address doesn't belong to the server", () => {
        expect(() =>
            verifyArkAddress(
                fixtures.mockArkInfo.signerPubkey.replaceAll("5", "6"),
                fixtures.mockArkAddress.valid
            )
        ).toThrow("Ark address doesn't belong to server's pubkey");
    });
});

describe("InsertCoin instance", () => {
    beforeAll(() => {
        vi.resetAllMocks();

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(fixtures.mockArkInfo),
        });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(fixtures.mockArkInfo),
        });
    });

    it("should create InsertCoin successfully", async () => {
        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).resolves.toBeInstanceOf(InsertCoin);
    });

    it("should throw on absent ark address", async () => {
        await expect(
            InsertCoin.create({
                arkAddress: "",
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).rejects.toThrow("Ark address is required");
    });

    it("should throw on absent ark server url", async () => {
        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: "",
                boltzApiUrl: fixtures.mockBoltzApiUrl,
            })
        ).rejects.toThrow("Ark server URL is required");
    });

    it("should throw on absent boltz api url", async () => {
        await expect(
            InsertCoin.create({
                arkAddress: fixtures.mockArkAddress.valid,
                arkServerUrl: fixtures.mockUrl,
                boltzApiUrl: "",
            })
        ).rejects.toThrow("Boltz API URL is required");
    });
});
