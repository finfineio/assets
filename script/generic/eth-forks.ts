import { ethForkChains } from "../generic/blockchains";
import {
    getChainAssetsPath,
    getChainAssetsList,
    getChainAssetPath,
    getChainAssetInfoPath,
    getChainAssetFilesList,
    isChainAssetInfoExistSync,
    logoName,
    logoExtension,
    logoFullName,
    getChainAssetLogoPath
} from "../generic/repo-structure";
import { formatJsonFile } from "../generic/json";
import {
    getFileName,
    getFileExt,
    gitMove,
    readDirSync,
    isPathExistsSync,
} from "../generic/filesystem";
import { toChecksum } from "../generic/eth-address";
import { ActionInterface, CheckStepInterface } from "../generic/interface";
import { isAssetInfoOK } from "../generic/asset-info";
import * as bluebird from "bluebird";

async function formatInfos() {
    console.log(`Formatting info files...`);
    await bluebird.each(ethForkChains, async (chain) => {
        let count = 0;
        const chainAssets = getChainAssetsList(chain);
        await bluebird.each(chainAssets, async (address) => {
            if (isChainAssetInfoExistSync(chain, address)) {
                const chainAssetInfoPath = getChainAssetInfoPath(chain, address);
                formatJsonFile(chainAssetInfoPath);
                ++count;
            }
        })
        console.log(`Formatted ${count} info files for chain ${chain} (total ${chainAssets.length})`);
    })
}

function checkAddressChecksum(assetsFolderPath: string, address: string, chain: string) {
    const checksumAddress = toChecksum(address, chain);
    if (checksumAddress !== address) {
        gitMove(assetsFolderPath, address, checksumAddress);
        console.log(`Renamed to checksum format ${checksumAddress}`);
    }
}

async function checkAddressChecksums() {
    console.log(`Checking for checksum formats ...`);
    await bluebird.each(ethForkChains, async (chain) => {
        const assetsPath = getChainAssetsPath(chain);

        await bluebird.each(readDirSync(assetsPath), async (address) => {
            await bluebird.each(getChainAssetFilesList(chain, address), async (file) => {
                if (getFileName(file) == logoName && getFileExt(file) !== logoExtension) {
                    console.log(`Renaming incorrect asset logo extension ${file} ...`);
                    gitMove(getChainAssetPath(chain, address), file, logoFullName);
                }
            });
            checkAddressChecksum(assetsPath, address, chain);
        });
    });
}

export class EthForks implements ActionInterface {
    getName(): string { return "Ethereum forks"; }
    
    getSanityChecks(): CheckStepInterface[] {
        const steps: CheckStepInterface[] = [];
        ethForkChains.forEach(chain => {
            steps.push(
                {
                    getName: () => { return `Folder structure for chain ${chain} (ethereum fork)`;},
                    check: async () => {
                        const errors: string[] = [];
                        const assetsFolder = getChainAssetsPath(chain);
                        const assetsList = getChainAssetsList(chain);
                        console.log(`     Found ${assetsList.length} assets for chain ${chain}`);
                        await bluebird.each(assetsList, async (address) => {
                            const assetPath = `${assetsFolder}/${address}`;
                            if (!isPathExistsSync(assetPath)) {
                                errors.push(`Expect directory at path: ${assetPath}`);
                            }
                            const inChecksum = toChecksum(address, chain);
                            if (address !== inChecksum) {
                                errors.push(`Expect asset at path ${assetPath} in checksum: '${inChecksum}'`);
                            }
                            const assetLogoPath = getChainAssetLogoPath(chain, address);
                            if (!isPathExistsSync(assetLogoPath)) {
                                errors.push(`Missing file at path '${assetLogoPath}'`);
                            }
                            const [isInfoOK, infoMsg] = isAssetInfoOK(chain, address);
                            if (!isInfoOK) {
                                errors.push(infoMsg);
                            }
                        });
                        return [errors, []];
                    }    
                }
            );
        });
        return steps;
    }
    
    async sanityFix(): Promise<void> {
        await formatInfos();
        await checkAddressChecksums();
    }
}
