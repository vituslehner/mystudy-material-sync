//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

export interface Enrollment {
    name: string;
    id: string;
    veranstaltung_id: string;
}

export interface Item {
    id: string;
    type: string;
    name: string;
    sanitizedName: string;
    isProtected: boolean;
    hasSubdirectories: boolean;
    accessGranted: boolean;
    children: Item[];
    timestamp: Date;
}

export const ITEM_TYPE = {
    file: "file",
    directory: "directory",
    lecture: "lecture"
};

export interface DownloadJob {
    item: Item;
    downloadFilePath: string;
    relativeDownloadFilePath: string;
}
