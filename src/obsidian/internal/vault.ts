import * as fs from "fs";
import * as fsAsync from "fs/promises";
import path from "path";
import { AUDIO_FILE_EXTENSIONS, VIDEO_FILE_EXTENSIONS } from "../../utils/constants";
import { Media } from "../../utils/interfaces";
import { getFilePaths } from "../../api/file/file.service";
import { Logger } from "../../api/logger/logger.service";
import { getBookmarkedNotePaths } from "./bookmarks";
import { Note } from "./notes";

const logger: Logger = new Logger("Vaults");

/**
 * Represents an Obsidian vault discovered either from Raycast preferences or
 * from Obsidian's own `obsidian.json` registry.
 *
 * @remarks
 * The `id` field is the opaque hash key Obsidian assigns to each vault in
 * `obsidian.json` (e.g. `"a3f9c1b2d8e4f0a1"`).  When present it should be
 * preferred over `name` when constructing `obsidian://` URIs because it
 * uniquely identifies the vault even when multiple vaults share the same
 * folder name.  Vaults sourced from Raycast preferences have no Obsidian-
 * assigned ID and will leave this field `undefined`.
 */
export interface ObsidianVault {
  /** Human-readable name derived from the vault's folder basename. */
  name: string;
  /** Stable React list key — always set to the vault's absolute file-system path. */
  key: string;
  /** Absolute file-system path to the vault root directory. */
  path: string;
  /**
   * Obsidian-internal hash ID from `obsidian.json`.
   * Only present for vaults discovered via {@link getVaultsFromObsidianJson}.
   */
  id?: string;
}

/** Gets a list of folders that are ignored by the user inside of Obsidian */
export function getExcludedFolders(vaultPath: string, configFileName: string): string[] {
  const appJSONPath = path.join(vaultPath, configFileName || ".obsidian", "app.json");
  if (!fs.existsSync(appJSONPath)) {
    return [];
  } else {
    const appJSON = JSON.parse(fs.readFileSync(appJSONPath, "utf-8"));
    return appJSON["userIgnoreFilters"] || [];
  }
}

/** Returns a list of file paths for all notes inside of the given vault, filtered by Raycast and Obsidian exclusions. */
export async function getMarkdownFilePaths(
  vaultPath: string,
  configFileName: string,
  excludedFolders: string[]
): Promise<string[]> {
  const userIgnoredFolders = getExcludedFolders(vaultPath, configFileName);
  excludedFolders.push(...userIgnoredFolders, configFileName);
  const files = await getFilePaths({
    path: vaultPath,
    excludedFolders,
    includedFileExtensions: [".md"],
  });
  logger.info(`Loaded ${files.length} markdown file paths in ${vaultPath}.`);
  return files;
}

/** Returns a list of file paths for all canvases inside of the given vault, filtered by Raycast and Obsidian exclusions. */
export async function getCanvasFilePaths(
  vaultPath: string,
  configFileName: string,
  excludedFolders: string[]
): Promise<string[]> {
  const userIgnoredFolders = getExcludedFolders(vaultPath, configFileName);
  excludedFolders.push(...userIgnoredFolders, configFileName);
  const files = await getFilePaths({
    path: vaultPath,
    excludedFolders,
    includedFileExtensions: [".canvas"],
  });
  logger.info(`Loaded ${files.length} canvas file paths in ${vaultPath}.`);
  return files;
}

export async function getNoteFileContent(path: string, filter?: (input: string) => string) {
  const content = await fsAsync.readFile(path, { encoding: "utf-8" });
  logger.debug(`Load file content for ${path}${filter ? " and filtering content." : ""}`);
  return filter ? filter(content) : content;
}

/** Gets a list of file paths for all media. */
async function getMediaFilePaths(vaultPath: string, configFileName: string, excludedFolders: string[]) {
  const userIgnoredFolders = getExcludedFolders(vaultPath, configFileName);
  excludedFolders.push(...userIgnoredFolders, configFileName);

  const files = await getFilePaths({
    path: vaultPath,
    excludedFolders,
    includedFileExtensions: [
      ...AUDIO_FILE_EXTENSIONS,
      ...VIDEO_FILE_EXTENSIONS,
      ".jpg",
      ".png",
      ".gif",
      ".mp4",
      ".pdf",
    ],
  });
  return files;
}

/** Gets media (images, pdfs, video, audio, etc.) for a given vault from disk. utils.useMedia() is the preferred way of loading media. */
export async function getMedia(vaultPath: string, configFileName: string, excludedFolders: string[]): Promise<Media[]> {
  logger.info("Loading Media Files");
  const medias: Media[] = [];
  const filePaths = await getMediaFilePaths(vaultPath, configFileName, excludedFolders);

  for (const filePath of filePaths) {
    const title = path.basename(filePath);

    const media: Media = {
      title,
      path: filePath,
    };
    medias.push(media);
  }
  return medias;
}

export async function getNotes(
  vaultPath: string,
  configFileName: string = ".obsidian",
  excludedFolders: string[] = []
): Promise<Note[]> {
  const filePaths = await getMarkdownFilePaths(vaultPath, configFileName, excludedFolders);
  const bookmarkedFilePaths = getBookmarkedNotePaths(vaultPath);
  const notes: Note[] = [];

  for (const filePath of filePaths) {
    const title = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(vaultPath, filePath);

    notes.push({
      title: title,
      path: filePath,
      lastModified: fs.statSync(filePath).mtime,
      bookmarked: bookmarkedFilePaths.includes(relativePath),
    });
  }

  // Add canvas files in a second pass. Canvas specific changes can be made here
  const canvasFilePaths = await getCanvasFilePaths(vaultPath, configFileName, excludedFolders);
  for (const canvasFilePath of canvasFilePaths) {
    const title = path.basename(canvasFilePath, path.extname(canvasFilePath));
    const relativePath = path.relative(vaultPath, canvasFilePath);

    notes.push({
      title: title,
      path: canvasFilePath,
      lastModified: fs.statSync(canvasFilePath).mtime,
      bookmarked: bookmarkedFilePaths.includes(relativePath),
    });
  }

  return notes;
}
