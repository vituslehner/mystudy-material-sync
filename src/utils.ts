//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

import { Item, ITEM_TYPE } from "./models";
import * as sanitize from "sanitize-filename";
import he = require("he");

export function jsonToItem(json: any): Item {
    if (!json.metadata || !json.metadata.name) {
        throw new Error("Failed to extract item: " + JSON.stringify(json));
    }
    const name = he.decode(json.metadata.name);
    return {
        id: json.metadata.id,
        name: name,
        sanitizedName: sanitizeFileSystemName(name),
        type: json.type,
        isProtected: json.metadata.protectsDescendants !== "0",
        hasSubdirectories: json.metadata.hasSubdirectories === "1",
        accessGranted: json.metadata.userHasAccess === "1",
        children: json.content
            ? (function(json: any) {
                  const subdirectories = json.content.subdirectories.map(jsonToItem);
                  const files = json.content.references.map(jsonToItem);
                  return [].concat(subdirectories, files);
              })(json)
            : []
    };
}

export function sanitizeFileSystemName(name: string) {
    return sanitize(name);
}

export function printItemRecursively(item: Item, depth: number = 0): void {
    const indent = "\t".repeat(depth + 1);
    console.log(indent, item.type === ITEM_TYPE.directory ? "`+" : "`-", item.name);
    for (const i of item.children) {
        printItemRecursively(i, depth + 1);
    }
}

export function itemPathToString(path: Item[]): string {
    return path.reduce((previousValue, currentValue) => previousValue + "/" + currentValue.sanitizedName, "");
}
