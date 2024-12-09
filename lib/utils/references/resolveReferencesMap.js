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

import GroupMessages from '../groupMessages.js';
import getPathFromName from './getPathFromName.js';
import getName from './getName.js';
import getValueByPath from './getValueByPath.js';
import usesReferences from './usesReferences.js';
import createReferenceRegex from './createReferenceRegex.js';
import defaults from './defaults.js';

const PROPERTY_REFERENCE_WARNINGS = GroupMessages.GROUP.PropertyReferenceWarnings;

/**
 * @typedef {import('../../../types/Config.d.ts').ResolveReferencesOptions} RefOpts
 * @typedef {import('../../../types/Config.d.ts').ResolveReferencesOptionsInternal} RefOptsInternal
 * @typedef {import('../../../types/DesignToken.d.ts').TransformedTokens} Tokens
 * @typedef {import('../../../types/DesignToken.d.ts').TransformedToken} Token
 */

/**
 * Public API wrapper around the functon below this one
 * @param {string} value
 * @param {Map<string, Token>} tokenMap
 * @param {RefOpts} [opts]
 * @returns {unknown}
 */
export function resolveReferences(value, tokenMap, opts) {
  // when using this public API / util, we always throw warnings immediately rather than
  // putting them in the GroupMessages PROPERTY_REFERENCE_WARNINGS to collect and throw later on.
  return _resolveReferences(value, tokenMap, opts);
}

/**
 * Utility to resolve references inside a string value
 * @param {string} value
 * @param {Map<string, Token>} tokenMap
 * @param {RefOptsInternal} [opts]
 * @returns {unknown}
 */
export function _resolveReferences(
  value,
  tokenMap,
  {
    regex,
    separator = defaults.separator,
    opening_character = defaults.opening_character,
    closing_character = defaults.closing_character,
    usesDtcg = false,
    warnImmediately = true,
    // for internal usage
    ignorePaths = [],
    current_context = [],
    stack = [],
    foundCirc = {},
    firstIteration = true,
  } = {},
) {
  let to_ret;
  const valProp = usesDtcg ? '$value' : 'value';
  const reg =
    regex ??
    createReferenceRegex({ opening_character, closing_character, separator, include_braces: true });

  // When we know the current context:
  // the key associated with the value that we are resolving the reference for
  // Then we can push this to the stack to improve our circular reference warnings
  // by starting them with the key
  if (firstIteration && current_context.length > 0) {
    stack.push(getName(current_context));
  }

  value.replace(reg, (match, /** @type {string} */ variable) => {
    /**
     * Replace the reference inline, but don't replace the whole string because
     * references can be part of the value such as "1px solid {color.border.light}"
     */

    const refHasValue = variable.endsWith(`.${valProp}`);
    // TODO: check if this is correct, might be other way around?
    if (refHasValue && ignorePaths.indexOf(variable) !== -1) {
      return '';
    } else if (!refHasValue && ignorePaths.indexOf(`${variable}.${valProp}`) !== -1) {
      return '';
    }

    stack.push(variable);
    const refWithoutValueSuffix = variable.replace(new RegExp(`\\.\\$?value$`), '');
    const ref = tokenMap.get(refWithoutValueSuffix)?.[valProp];

    if (typeof ref !== 'undefined') {
      if (typeof ref === 'string') {
        to_ret = value.replace(match, `${ref}`);
        // Recursive, therefore we can compute multi-layer variables like a = b, b = c, eventually a = c
        if (usesReferences(ref)) {
          // Compare to found circular references
          if (Object.hasOwn(foundCirc, ref)) {
            // If the current reference is a member of a circular reference, do nothing
          } else if (stack.indexOf(ref) !== -1) {
            // If the current stack already contains the current reference, we found a new circular reference
            // chop down only the circular part, save it to our circular reference info, and spit out an error

            // Get the position of the existing reference in the stack
            const stackIndexReference = stack.indexOf(ref);

            // Get the portion of the stack that starts at the circular reference and brings you through until the end
            const circStack = stack.slice(stackIndexReference);

            // For all the references in this list, add them to the list of references that end up in a circular reference
            circStack.forEach(function (key) {
              foundCirc[key] = true;
            });

            // Add our found circular reference to the end of the cycle
            circStack.push(ref);

            // Add circ reference info to our list of warning messages
            const warning = `Circular definition cycle: ${circStack.join(', ')}`;
            if (warnImmediately) {
              throw new Error(warning);
            } else {
              GroupMessages.add(
                PROPERTY_REFERENCE_WARNINGS,
                'Circular definition cycle:  ' + circStack.join(', '),
              );
            }
          } else {
            to_ret = _resolveReferences(ref, tokenMap, {
              ignorePaths,
              usesDtcg,
              warnImmediately,
              current_context,
              stack,
              foundCirc,
              firstIteration: false,
            });
          }
        } else {
          to_ret = ref;
        }
      } else {
        // if evaluated value is a, we want to keep the type
        to_ret = ref;
      }
    } else {
      // User might have passed current_context option which is path (arr) pointing to key
      // that this value is associated with, helpful for debugging
      const warning = `${
        current_context ? `${current_context} ` : ''
      }tries to reference ${value}, which is not defined.`;
      if (warnImmediately) {
        throw new Error(warning);
      } else {
        GroupMessages.add(PROPERTY_REFERENCE_WARNINGS, warning);
      }
      to_ret = ref;
    }
    stack.pop();
  });

  return to_ret;
}
