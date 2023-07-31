//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

import { config } from "dotenv";

import { myStudyClient } from "./client";
import * as cheerio from "cheerio";
import { AxiosResponse } from "axios";
import { DownloadJob, Enrollment, Item, ITEM_TYPE } from "./models";
import { jsonToItem, itemPathToString, sanitizeFileSystemName } from "./utils";
import * as os from "os";
import { constants } from "./constants";
import * as fs from "fs";


class App {
    async run() {
        const userDirectory = os.homedir();
        console.debug("-- User directory:", os.homedir());

        let downloadBasePath = process.env.MYSTUDY_DOWNLOAD_DIRECTORY || constants.local.downloadDirectory;
        if (downloadBasePath.startsWith("~/")) {
            downloadBasePath = userDirectory + "/" + downloadBasePath.slice(2);
        }
        console.debug("-- Download directory:", downloadBasePath);

        const homepageResponse: AxiosResponse = await myStudyClient.getHomepage();

        const loginResponse: AxiosResponse = await myStudyClient.postLogin(
            process.env.MYSTUDY_USERNAME,
            process.env.MYSTUDY_PASSWORD
        );
        App.checkLoginSuccess(loginResponse);
        console.info("\n-- Login successful!");

        const dashboardResponse: AxiosResponse = await myStudyClient.getDashboard();
        const dashboardDom: CheerioStatic = cheerio.load(dashboardResponse.data);

        const semester = App.extractSemesterFromDashboard(dashboardDom);
        const semesterBasePath = downloadBasePath + "/" + sanitizeFileSystemName(semester);
        console.info("-- Semester:", semester);
        console.info("-- Semester directory:", semesterBasePath);

        const enrollmentsResponse: AxiosResponse = await myStudyClient.getEnrollments();
        const enrollments = App.validateAndExtractEnrollments(enrollmentsResponse.data);
        console.info("\nEnrollments:");
        enrollments.forEach(e => console.info(" ▸", e.name, e.veranstaltung_id));

        const items = await Promise.all(
            enrollments.map(async e => {
                const enrollmentResponse: AxiosResponse = await myStudyClient.getEnrollmentFileManager(
                    e.veranstaltung_id
                );
                const enrollmentDom: CheerioStatic = cheerio.load(enrollmentResponse.data);

                const lectureItem = App.validateAndExtractLectureItem(enrollmentDom);
                return await App.loadFileTreeRecursively(lectureItem);
                // printItemRecursively(lectureTree);
            })
        );

        App.ensureLocalDirectories(downloadBasePath, semesterBasePath);

        const jobs = items
            .map(i => App.syncItemRecursively(i, [], semesterBasePath))
            .reduce((previousJobs, currentJobs) => {
                return previousJobs.concat(currentJobs);
            }, []);

        await App.processDownloadJobs(jobs);
    }

    private static checkLoginSuccess(loginResponse: AxiosResponse) {
        if (!loginResponse.headers.location || !loginResponse.headers.location.endsWith("/dashboard/default")) {
            throw new Error("Login failed: Bad credentials");
        }
    }

    private static extractSemesterFromDashboard(dashboardDom: CheerioStatic) {
        const userInfoElements = dashboardDom("#user-settings-menu .user-info-close span");
        return userInfoElements
            .last()
            .text()
            .replace("|", "")
            .trim()
            .replace(" ", "-");
    }

    private static validateAndExtractEnrollments(enrollmentsData: any) {
        if (enrollmentsData.liste && enrollmentsData.liste.length > 0) {
            return enrollmentsData.liste as Enrollment[];
        }
        throw new Error("Can not read enrollments: Empty list or invalid format (Are you actually enrolled somewhere for this semester?)");
    }

    private static validateAndExtractLectureItem(fileManagerDom: CheerioStatic) {
        const fileManagerString = fileManagerDom("div#dateimanager").get(0).attribs.dateimanager;

        const json = JSON.parse(fileManagerString);
        const items = json.root_directories.map(jsonToItem);

        if (items.length !== 1) {
            throw new Error("Failed to read lecture item. Lecture count: " + items.length);
        }

        return items[0] as Item;
    }

    private static async loadFileTreeRecursively(item: Item): Promise<Item> {
        if (item.type === ITEM_TYPE.file || (item.isProtected && !item.accessGranted)) {
            return Promise.resolve(item);
        }

        const itemResponse = await myStudyClient.getFileManagerDirectory(item.id);
        const refreshedItem = jsonToItem(itemResponse.data);
        const refreshedChildren = await Promise.all(
            refreshedItem.children.map(async i => {
                return await App.loadFileTreeRecursively(i);
            })
        );

        return Promise.resolve({
            ...refreshedItem,
            children: refreshedChildren
        });
    }

    private static syncItemRecursively(item: Item, path: Item[], basePath: string): DownloadJob[] {
        const itemPath = basePath + itemPathToString(path) + "/" + item.sanitizedName;
        const jobs = [];
        const fileExists = fs.existsSync(itemPath);
        const timeModifiedIdentical = fileExists && item.timestamp.getTime() == fs.statSync(itemPath).mtime.getTime();

        if (fileExists && !timeModifiedIdentical && (item.type !== ITEM_TYPE.lecture) && (item.type !== ITEM_TYPE.directory)) {
            const new_basedir = basePath + "/modified";
            if (!fs.existsSync(new_basedir)) {
                fs.mkdirSync(new_basedir);
            }
            console.log("The file \"" + itemPath + "\" already exists bit the modification times differ.",
                        "We will therefore download it into \"" + new_basedir + "\"");
            return App.syncItemRecursively(item, [], new_basedir);
        }

        if (fileExists) {
            // console.debug("-- Already exists:", itemPath);
            // console.debug("---- item timestamp:", item.timestamp);
            // console.debug("---- file timestamp modified:", fs.statSync(itemPath).mtime);
            // console.debug("---- file timestamp created:", fs.statSync(itemPath).ctime);
        } else {
            if (item.type === ITEM_TYPE.lecture && item.children.length === 0) {
                console.debug("-- Skipping because lecture empty:", item.name);
            } else if (!fileExists && (item.type === ITEM_TYPE.lecture || item.type === ITEM_TYPE.directory)) {
                console.info("-- Creating directory for", item.name);
                fs.mkdirSync(itemPath);
                // console.info("-- Finished creating directory for", item.name);
            } else if (item.type === ITEM_TYPE.file) {
                jobs.push({ item: item, downloadFilePath: itemPath } as DownloadJob);
            }
        }

        return item.children
            .map(i => this.syncItemRecursively(i, path.concat([item]), basePath))
            .reduce((previousJobs, currentJobs) => {
                return previousJobs.concat(currentJobs);
            }, jobs);
    }

    private static ensureLocalDirectories(downloadBasePath: string, semesterBasePath: string) {
        if (!fs.existsSync(downloadBasePath)) {
            fs.mkdirSync(downloadBasePath);
        }
        if (!fs.existsSync(semesterBasePath)) {
            fs.mkdirSync(semesterBasePath);
        }
    }

    private static async processDownloadJobs(jobs: DownloadJob[]) {
        for (const job of jobs) {
            console.info("-- Downloading", `"${job.downloadFilePath}"`);
            const downloadResponse: AxiosResponse = await myStudyClient.getDownload(job.item.id);
            const fd = fs.openSync(job.downloadFilePath, "w");
            const stream = fs.createWriteStream(undefined, {fd: fd});
            downloadResponse.data.pipe(stream);
            stream.on("close", () => {
                fs.utimesSync(job.downloadFilePath, job.item.timestamp, job.item.timestamp);
            });
            console.info("   Finished");
        }
    }
}

try {
    config();

    const app: App = new App();
    app.run();
} catch (e) {
    console.error("Ein Fehler ist aufgetreten!");
    console.error("Details:", e);
}
