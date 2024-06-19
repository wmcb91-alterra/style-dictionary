/*
 * Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

import JSON5 from 'json5';
import { globSync } from '@bundled-es-modules/glob';
import { extname } from 'path-unified';
import { fs } from 'style-dictionary/fs';
import { resolve } from '../resolve';
import deepExtend from './deepExtend';
import { detectDtcgSyntax } from './detectDtcgSyntax';
import type { DesignTokens, DesignToken, Parser, Volume } from '../types';

/**
 * @param {Tokens} obj
 * @param {(obj: Tokens|Token, key: keyof Tokens|Token, slice: Tokens|Token) => void} fn
 */
function traverseObj(
  obj: DesignTokens,
  fn: (
    obj: DesignTokens | DesignToken,
    key: keyof DesignTokens | DesignToken,
    slice: DesignTokens | DesignToken,
  ) => void,
) {
  for (let key in obj) {
    fn.apply(null, [obj, key, obj[key]]);
    if (obj[key] && typeof obj[key] === 'object') {
      traverseObj(obj[key], fn);
    }
  }
}

/**
 * Takes an array of json files and merges
 * them together. Optionally does a deep extend.
 * @private
 * @param {string[]} arr - Array of paths to json (or node modules that export objects) files
 * @param {Boolean} [deep=false] - If it should perform a deep merge
 * @param {Function} [collision] - A function to be called when a name collision happens that isn't a normal deep merge of objects
 * @param {boolean} [source] - If json files are "sources", tag tokens
 * @param {Record<string, Omit<Parser, 'name'>>} [parsers] - Custom file parsers
 * @param {boolean} [usesDtcg] - Whether or not tokens are using DTCG syntax.
 * @param {Volume} [vol] - Filesystem volume to use
 * @returns {Promise<{tokens: Tokens, usesDtcg: boolean|undefined }>}
 */
export default async function combineJSON(
  arr: string[],
  deep = false,
  collision: Function | undefined,
  source = true,
  parsers: Record<string, Omit<Parser, 'name'>> = {},
  usesDtcg: boolean | undefined,
  vol: Volume,
) {
  const volume = vol ?? fs;

  const to_ret: DesignTokens = {};
  let files: string[] = [];

  for (let i = 0; i < arr.length; i++) {
    const new_files = globSync(arr[i], { fs: volume, posix: true }).sort();
    files = files.concat(new_files);
  }

  if (typeof window === 'object') {
    // adjust for browser env glob results have leading slash
    // make sure we dont remove these in Node, that would break absolute paths!!
    files = files.map((f) => f.replace(/^\//, ''));
  }

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const resolvedPath = resolve(filePath, vol?.__custom_fs__);
    let file_content = null;
    try {
      for (const { pattern, parser } of Object.values(parsers)) {
        if (filePath.match(pattern)) {
          file_content = await parser({
            contents: volume.readFileSync(resolvedPath, 'utf-8') as string,
            filePath: resolvedPath,
          });
        }
      }

      // If there is no file_content then no custom parser ran on that file
      if (!file_content) {
        if (['.js', '.mjs'].includes(extname(filePath))) {
          let resolvedPath = resolve(filePath, vol?.__custom_fs__);
          // eslint-disable-next-line no-undef
          if (typeof window !== 'object' && process?.platform === 'win32') {
            // Windows FS compatibility. If in browser, we use an FS shim which doesn't require this Windows workaround
            resolvedPath = new URL(`file:///${resolvedPath}`).href;
          }
          file_content = (await import(/* @vite-ignore */ /* webpackIgnore: true */ resolvedPath))
            .default;
        } else {
          file_content = JSON5.parse(volume.readFileSync(resolvedPath, 'utf-8') as string);
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        e.message = 'Failed to load or parse JSON or JS Object: ' + e.message;
        throw e;
      }
    }

    if (file_content) {
      if (usesDtcg === undefined) {
        usesDtcg = detectDtcgSyntax(file_content);
      }
      // Add some side data on each property to make filtering easier
      traverseObj(file_content, (obj) => {
        if (Object.hasOwn(obj, `${usesDtcg ? '$' : ''}value`) && !obj.filePath) {
          obj.filePath = filePath;

          obj.isSource = source;
        }
      });

      if (deep) {
        deepExtend([to_ret, file_content], {
          collision,
          overrideKeys: [usesDtcg ? '$value' : 'value'],
        });
      } else {
        Object.assign(to_ret, file_content);
      }
    }
  }

  return { tokens: to_ret, usesDtcg };
}
