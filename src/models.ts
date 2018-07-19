//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

export class Enrollment {
    name: string;
    id: string;
    veranstaltung_id: string;
}

export class Item {
    id: string;
    type: string;
    name: string;
    sanitizedName: string;
    isProtected: boolean;
    hasSubdirectories: boolean;
    accessGranted: boolean;
    children: Item[];
}

export const ITEM_TYPE = {
    file: "file",
    directory: "directory",
    lecture: "lecture"
};

export class DownloadJob {
    item: Item;
    downloadFilePath: string;
    relativeDownloadFilePath: string;
}
