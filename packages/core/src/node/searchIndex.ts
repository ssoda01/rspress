import path, { join } from 'path';
import fs from '@rspress/shared/fs-extra';
import chalk from '@rspress/shared/chalk';
import type { IncomingMessage, ServerResponse } from 'http';
import fetch from 'node-fetch';
import { UserConfig, isSCM, SEARCH_INDEX_NAME } from '@rspress/shared';
import { logger } from '@rspress/shared/logger';
import { isProduction, OUTPUT_DIR, TEMP_DIR } from './constants';

export async function writeSearchIndex(config: UserConfig) {
  if (config?.search === false) {
    return;
  }
  const cwd = process.cwd();
  // get all search index files, format is `${SEARCH_INDEX_NAME}.xxx.${hash}.json`
  const searchIndexFiles = await fs.readdir(TEMP_DIR);
  const outDir = config?.outDir ?? join(cwd, OUTPUT_DIR);

  // For performance, we only stitch the string of search index data instead of big JavaScript object in memory
  let searchIndexData = '[]';
  let scaning = false;
  for (const searchIndexFile of searchIndexFiles) {
    if (
      !searchIndexFile.includes(SEARCH_INDEX_NAME) ||
      !searchIndexFile.endsWith('.json')
    ) {
      continue;
    }
    const source = join(TEMP_DIR, searchIndexFile);
    const target = join(outDir, 'static', searchIndexFile);
    fs.copyFile(
      join(TEMP_DIR, searchIndexFile),
      `/Users/soda.xu/works/demo-workspace/rspress/temp/${searchIndexFile}`,
      err => {
        if (err) {
          console.error('Error copying file:', err);
        } else {
          console.log('File copied successfully!');
          // 在这里继续处理复制后的文件
          // 比如读取、追加内容等等
        }
      },
    );
    const searchIndex = await fs.readFile(
      join(TEMP_DIR, searchIndexFile),
      'utf-8',
    );

    fs.appendFile(
      '/Users/soda.xu/works/demo-workspace/rspress/temp/index10.txt',
      `${TEMP_DIR} - ${searchIndexFile}\n`,
      'utf-8',
      err => {
        if (err) {
          console.error('Error writing file:', err);
        } else {
          console.log('File written successfully!');
        }
      },
    );
    console.log('outDir', outDir);
    // TODO 这里file中 没有输出code文件
    fs.appendFile(
      '/Users/soda.xu/works/demo-workspace/rspress/temp/index.txt',
      searchIndex,
      'utf-8',
      err => {
        if (err) {
          console.error('Error writing file:', err);
        } else {
          console.log('File written successfully!');
        }
      },
    );
    searchIndexData = `${searchIndexData.slice(0, -1)}${
      scaning ? ',' : ''
    }${searchIndex.slice(1)}`;
    await fs.move(source, target, { overwrite: true });
    scaning = true;
  }

  if (isProduction() && isSCM() && config?.search?.mode === 'remote') {
    const { apiUrl, indexName } = config.search;
    try {
      await fetch(`${apiUrl}?index=${indexName}`, {
        method: 'PUT',
        body: searchIndexData,
        headers: { 'Content-Type': 'application/json' },
      });

      logger.info(
        chalk.green(
          `[doc-tools] Search index uploaded to ${apiUrl}, indexName: ${indexName}`,
        ),
      );
    } catch (e) {
      logger.info(
        chalk.red(
          `[doc-tools] Upload search index \`${indexName}\` failed:\n ${e}`,
        ),
      );
    }
  }
}

type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

export function serveSearchIndexMiddleware(config: UserConfig): RequestHandler {
  return (req, res, next) => {
    const searchIndexRequestMatch = `/${SEARCH_INDEX_NAME}.`;
    if (req.url?.includes(searchIndexRequestMatch)) {
      res.setHeader('Content-Type', 'application/json');
      // Get search index name from request url
      const searchIndexFile = req.url?.split('/').pop();
      fs.createReadStream(
        path.join(
          process.cwd(),
          config?.outDir || OUTPUT_DIR,
          'static',
          searchIndexFile,
        ),
        'utf-8',
      ).pipe(res, { end: true });
    } else {
      next?.();
    }
  };
}
